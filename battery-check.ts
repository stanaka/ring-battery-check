import "dotenv/config";
import { RingApi } from "ring-client-api";
import { readFile, writeFile, existsSync } from "fs";
import { promisify } from "util";
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { updateSecret } from './github-secrets.js';

const dataColumns = [
  'cocoa_doorbell/Front Door',
  'cocoa_spotlight/Front',
  'cocoa_spotlight/Garage',
  'cocoa_spotlight/Garden',
  'cocoa_camera/Kitchen',
  'cocoa_camera/Entrance',
  'cocoa_camera/Garage',
];
const data = new Map<string, number>
const csvData = [];

async function output(sheet: GoogleSpreadsheetWorksheet) {
  const padStart = (value: number): string => value.toString().padStart(2, '0');
  const date = new Date();
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  const minutes = date.getMinutes();
  const hours = date.getHours();
  const seconds = date.getSeconds();
  const myFormattedDate = year+"-"+padStart(monthIndex+1)+"-"+padStart(day)+" "
    +padStart(hours)+":"+padStart(minutes)+":"+padStart(seconds);
  const columns: string[] = [];
  let str = myFormattedDate + ", "
  columns.push(myFormattedDate);

  for (const key of dataColumns){
    const d = data.get(key)
    str += `${d}, `;
    columns.push(`${d}`)
  }
  console.log(str)
  await sheet.addRow(columns);
}

async function initSheet(email: string, key: string, sheetId: string): Promise<GoogleSpreadsheetWorksheet> {
  console.log(email)
  // Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication
  const serviceAccountAuth = new JWT({
    // env var values here are copied from service account credentials generated by google
    // see "Authentication" section in docs for more info
    email: email,
    key: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);
  return doc.sheetsByIndex[0]
}

async function finalize(ringApi: RingApi, sheet: GoogleSpreadsheetWorksheet){
  await ringApi.disconnect()
  await output(sheet);
  process.exit(0)
}

async function example() {
  const { env } = process,
    ringApi = new RingApi({
      // This value comes from the .env file
      refreshToken: env.RING_REFRESH_TOKEN!,
      debug: true,
    }),
    locations = await ringApi.getLocations(),
    allCameras = await ringApi.getCameras();

  //const key = env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON_FILE ?
  //  require('../' + env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON_FILE) :
  //  env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON
  // const key = require('../' + env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON_FILE)
  const keyJson = env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON_FILE ?
    await promisify(readFile)('./' + env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON_FILE) :
    env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON || ''
  const key  = JSON.parse(keyJson.toString())

  console.log("Initialize sheet with ", key.client_email)
  const sheet = await initSheet(key.client_email, key.private_key, env.GOOGLE_SPREADSHEET_ID!)

  console.log(
    `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`
  );

  let jobDoneCount = 0;

  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
      console.log("Refresh Token Updated"); // ": ", newRefreshToken);

      // If you are implementing a project that use `ring-client-api`, you should subscribe to onRefreshTokenUpdated and update your config each time it fires an event
      // Here is an example using a .env file for configuration
      if (!oldRefreshToken) {
        return;
      }

      if (existsSync(".env")) {
        const currentConfig = await promisify(readFile)(".env"),
          updatedConfig = currentConfig
            .toString()
            .replace(oldRefreshToken, newRefreshToken);

        await promisify(writeFile)(".env", updatedConfig);
      }

      const REPO = process.env.GITHUB_REPOSITORY || '';
      const SECRET_NAME = "RING_REFRESH_TOKEN";
      updateSecret(REPO, SECRET_NAME, newRefreshToken);

      jobDoneCount += 1;
      if (jobDoneCount == 2){
        console.log("disconnect at the end of the notification")
        await finalize(ringApi, sheet)
      } else {
        console.log("jobDoneCount: ", jobDoneCount);
      }
    }
  );
  
  for (const location of locations) {
    const cameras = location.cameras,
      devices = await location.getDevices();

    console.log(
      `\nLocation ${location.name} (${location.id}) has the following ${cameras.length} camera(s):`
    );
    for (const camera of cameras.sort((a,b) => {
      if(a.deviceType > b.deviceType){
        return 1
      }
      if(a.deviceType < b.deviceType){
        return -1
      }
      if(a.name > b.name) {
        return 1
      }
      return -1
    })) {
      console.log(`- ${camera.id}: ${camera.name} (${camera.deviceType}) offline: ${camera.isOffline} battery_level: ${camera.batteryLevel}`);
      data.set(camera.deviceType as string + '/' + camera.name, camera.batteryLevel || 0);
    }
  }

  jobDoneCount += 1;
  if (jobDoneCount == 2){
    console.log("disconnect at the end of the notification")
    await finalize(ringApi, sheet)
  } else {
    console.log("jobDoneCount: ", jobDoneCount);
  }
}

example();
