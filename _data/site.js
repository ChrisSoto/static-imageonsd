import getW3CDate from "../helper.js";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const site = {
  url: "https://imageonsd.com",
  env: process.env.ENVIRONMENT,
  time: getW3CDate(),
};

if (process.env.ENVIRONMENT == "development") {
  site.url = "http://localhost:8080";
}

if (process.env.ENVIRONMENT == "staging") {
  site.url = "https://staging.imageonsd.com";
}

export default site