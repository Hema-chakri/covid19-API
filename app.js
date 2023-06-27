const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
//Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT 
            *
        FROM
            user
        WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "edcswunmjhgkti");
      response.send({ jwtToken });
    } else if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      jwt.verify(jwtToken, "edcswunmjhgkti", async (error, payload) => {
        const authHeader = request.headers["authorization"];
        const jwtTokenAccessed = authHeader.split(" ")[1];
        if (error) {
          response.send("Invalid JWT Token");
        }
      });
    }
  }
});

//Get states API
app.get("/states/", async (request, response) => {
  const getStatesQuery = `
    SELECT *
    FROM state
    ORDER BY state_id;`;
  const statesList = await db.all(getStatesQuery);
  response.send(
    statesList.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

//Get selected state API
app.get("/states/:stateId/", async (request, response) => {
  const { stateId } = request.params;
  const getSpecificState = `
    SELECT *
    FROM state
    WHERE state_id = ${stateId};`;
  const state = await db.get(getSpecificState);
  response.send(convertDbObjectToResponseObject(state));
});

//Add district API
app.post("/districts/", async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
        INSERT INTO
            district( district_name, state_id, cases, cured, active, deaths )
        VALUES
        (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        )
    ;`;
  const dbResponse = await db.run(addDistrictQuery);
  const districtId = dbResponse.lastId;
  response.send("District Successfully Added");
});

//Get a Specific API
app.get("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `
    SELECT
        *
    FROM 
        district
    WHERE district_id = ${districtId};`;
  const district = await db.get(getDistrictQuery);
  response.send(convertDistrictObjectToResponseObject(district));
});

//Delete Specific district API
app.delete("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `
    DELETE
    FROM
        district
    WHERE district_id = ${districtId};`;
  await db.run(deleteDistrictQuery);
  response.send("District Removed");
});

//Update district API
app.put("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const bodyDetails = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = bodyDetails;
  const updateDistrictQuery = `
    UPDATE
        district
    SET
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE
        district_id = ${districtId};`;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

module.exports = app;
