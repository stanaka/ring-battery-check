# ring-battery-check

This is a script to check ring batteries.

## Setup

`npm install`

## Authentication (for Ring)

This is the same steps with ring-client-api.

- Run `npm run auth` to start the process. It should prompt you for email/password/token
- You will see a refresh token output like `"refreshToken": "eyJhbGciOi...afa1"`. You need to extract the value from the second part of this output, between the double quotes.
- Create a `.env` file in the root directory of this project and insert the following contents, replacing value with the one you got from the auth command above. _Make sure you don't include the quotes_:

```text
RING_REFRESH_TOKEN=eyJhbGciOi...afa1
```

## Authentication (for Google Spreadsheet)

- Create a service account key to access a Google Spreadsheet.
- Add `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` to `.env`
- Add `GOOGLE_SPREADSHEET_ID` to `.env`

## Run the Example

`npm run start`
