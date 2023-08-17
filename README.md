## weather-data

* A simple program that acts as a data store for weather data from sensors


Default Login:

   ```
   email: admin@admin.com / password: pass
   ```


#### Instructions

#### Docker (recommended):

1. Run:

   ```
   docker run -d -p 3005:3005 -e JWT_SECRET=somethingsecret ashaibani/weather-data:main
   ```

#### Build locally:

1. Clone this repo
2. Run:

   ```
   npm i
   npx prisma generate
   npm run start
   ```
