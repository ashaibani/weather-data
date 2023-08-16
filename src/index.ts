import express from 'express'
import { sign } from "jsonwebtoken";
import { expressjwt, Request as JWTRequest } from "express-jwt";
import { Options, parse } from "csv-parse";
import { Prisma } from '@prisma/client';

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const app = express()
const dotenv = require('dotenv');
dotenv.config();

// get jwt secret from .env
const jwtSecret = process.env.JWT_SECRET ?? "123placehol123dersecret123"

// setup jwt middleware
app.use(
    expressjwt({
        secret: jwtSecret,
        algorithms: ["HS256"],

        // exclude login path
    }).unless({ path: ["/api/login"] })
);

app.use(function (err: any, req: JWTRequest, res: express.Response, next: any) {
    if (err.name === "UnauthorizedError") {
        res.status(401).send("Invalid JWT Token.");
    } else {
        next(err);
    }
});

// WeatherData data modal of data returned by weather sensors
type WeatherData = {
    // timestamp in seconds
    timestamp: number,
    // temprature in celsius
    temperature: number,
    // rainfall in mm
    rainfall: number,
    // humidity in %
    humidity: number,
    // windspeed in mph
    wind_speed: number,
    // visibility scale from very poor to excellent
    visibility: 'VP' | 'P' | 'M' | 'G' | 'VG' | 'E'
};

// POST “/api/login” - authentication endpoint, the body of requests to this endpoint should be
// JSON, with an email and password, e.g.
// { “email”: “admin@admin.com”, “password”: “pass” }
// The request should respond with a cookie that can be used for subsequent requests.
app.post('/api/login', express.json(), async (req: express.Request, res: express.Response, next: any) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(403)
            .json({ message: "Invalid login credentials." })
    }
    const user = await db.user.findUnique({
        where: {
            email,
        },
    })

    if (!user) {
        res.status(403)
            .json({ message: "Invalid login credentials." })
        return
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        res.status(403)
            .json({ message: "Invalid login credentials." })
        return
    }


    res.json({
        accessToken: sign(req.body.email, jwtSecret)
    })
})


// POST “/api/sensors/upload” - this endpoint will receive data from the sensors. It should be
// authenticated utilizing the cookie from the login request. The CSV data will be sent in the POST
// body, which should then be stored in a way that allows for it to be queryable.
app.post('/api/sensors/upload', express.text(), async (req: JWTRequest, res: express.Response, next: any) => {
    if (req.body.length == 0) {
        res.status(500).json({ message: "Invalid csv file provided." })
        return
    }

    const headers = ['timestamp', 'temperature', 'rainfall', 'humidity', 'wind_speed', 'visibility'];
    var options: Options = {
        delimiter: ',',
        columns: headers,
        fromLine: 2
    }

    // parse csv content from request body
    await parse(req.body, options, async (error, result: WeatherData[]) => {
        if (error) {
            res.status(500)
                .json({ message: "Invalid csv file provided." })
            return
        }
        if (result.length == 0) {
            res.status(500)
                .json({ message: "Invalid csv file provided." })
            return
        }

        for (let index = 0; index < result.length; index++) {
            const weatherData = result[index];
            await db.weatherData.create({
                data: {
                    timestamp: +weatherData.timestamp,
                    temperature: +weatherData.temperature,
                    rainfall: +weatherData.rainfall,
                    humidity: +weatherData.humidity,
                    wind_speed: +weatherData.wind_speed,
                    visibility: weatherData.visibility,
                }
            })
        }
    });

    res.send('Success!')
})


// POST “/api/sensors/search” - this endpoint will be used to retrieve data and again should be
// authenticated utilizing the cookie from the login request. This request can perform three key
// functions:
// - Grouping the data of a sensor
// - Filtering the data of a sensor
// - Sorting the data of a sensor
// The endpoint should return all of the data which matches given the above parameters, the
// request body will be in the form of a JSON object
//
//
// The following options are available for the various search keys:
// 1. Filters, the following filter operators should be supported: “gte”, greater than or equal, “lte”, less
// than or equal and “eq”, equals, returned results must match all of the provided filters.
// 2. Sort - the column can be any of the columns in the CSV, the order can be either “descending” or
// “ascending”.
// 3. Aggregate - the column can be any of the data columns in the CSV (not timestamp) and should
// support the aggregate functions of COUNT, MAX, MIN, SUM and AVG.
app.post('/api/sensors/search', express.json(), async (req: JWTRequest, res: express.Response) => {
    const { filters, sort, aggregate } = req.body
    var searchParams: Prisma.WeatherDataFindManyArgs = {}
    var whereClause: Prisma.WeatherDataWhereInput = {}
    const orderByClause: Prisma.WeatherDataOrderByWithRelationInput = {}
    var results = []

    // handle search where filters
    if (filters) {
        var isFirst = true
        const individualFilters = Object.keys(filters)
        for (let index = 0; index < individualFilters.length; index++) {
            const column: any = individualFilters[index];
            var element = filters[column];

            // strip eq and replace with equal property that prisma expects
            if (element['eq']) {
                const oldValue = element['eq']
                const { eq: _, ...newObj } = element;
                newObj['equals'] = oldValue
                element = newObj
            }
            var localWhereClause: Prisma.WeatherDataWhereInput = {}
            assign(localWhereClause, column, element)

            if (isFirst) {
                whereClause = localWhereClause
                isFirst = false
            } else {
                if (Array.isArray(whereClause.AND)) {
                    whereClause.AND = [...whereClause.AND, localWhereClause]
                } else {
                    whereClause.AND = [localWhereClause]
                }
            }
        }
        searchParams.where = whereClause
    }

    // handle search order by caluse
    if (sort) {
        assign(orderByClause, sort.column, (sort.order == 'descending' || sort.order == 'desc') ? 'desc' : 'asc')
        searchParams.orderBy = orderByClause
    }

    // handle aggregation
    if (aggregate) {
        const aggregateColumn = aggregate.column
        const aggregateOperator = aggregate.operator
        const aggregateClause: Prisma.WeatherDataAggregateArgs = { where: whereClause, orderBy: orderByClause }
        var localAggregateClause: Prisma.WeatherDataCountAggregateInputType = {}
        assign(localAggregateClause, aggregateColumn, true)

        switch (aggregateOperator.toUpperCase()) {
            case 'COUNT':
                aggregateClause._count = localAggregateClause
                break
            case 'MAX':
                aggregateClause._max = localAggregateClause
                break
            case 'MIN':
                aggregateClause._min = localAggregateClause
                break
            case 'AVG':
                aggregateClause._avg = localAggregateClause
                break
            case 'SUM':
                aggregateClause._sum = localAggregateClause
                break
        }

        try {
            results = await db.weatherData.aggregate(aggregateClause)
        } catch (error) {
            res.status(500)
                .json({ message: "Invalid search parameters provided. " })
            return
        }

    } else {
        try {
            results = await db.weatherData.findMany(searchParams)
        } catch (error) {
            res.status(500)
                .json({ message: "Invalid search parameters provided. " })
            return
        }

    }

    res.json(results)
})

// ty stackoverflow - https://stackoverflow.com/questions/74526023/setting-object-property-by-string-name
function assign<T extends object, K extends keyof T>(
    obj: T, key: K, val: T[K]
) {
    obj[key] = val;
}

// start app
app.listen(3005, () => {
    console.log(`Weather data storage listening on port 3005`)
})
