# Apple Webstore Monitor

Apple Webstore Monitor is an open-source program written in NodeJS designed to check the availability of products in Apple stores.

## Table of Contents

- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Usage](#usage)
- [Notification Example](#notification-example)

## Key Features

1. **Multi-product monitoring**: Ability to search multiple products in a given zip code.
2. **Multi-country support**: Supports United States, United Kingdom, Canada and Australia.

## Prerequisites

- **Node**: You need a version >=18.16.0 of [Node](https://nodejs.org/en/download) installed.
- **NPM**: You need a version of >=9.5.1 of NPM installed.

## Configuration 

For the tool to function correctly, `data.csv` is required with the following data:

### data.csv Parameters

| Parameter            | Description                                         | Example Values                               |
|----------------------|-----------------------------------------------------|----------------------------------------------|
| COUNTRY              | The country where the operation will be conducted   | `COUNTRY=us`                                 |
| PRODUCTS             | List of product codes to monitor                    | `PRODUCTS=MU683LL/A,MU663LL/A,MU693LL/A`     |
| MAXDISTANCE          | Maximum distance to cover from the zip code         | `MAXDISTANCE=25`                             |
| ZIP                  | The zip code for the location of operation          | `ZIP=95121`                                  |
| WEBHOOKURL           | Webhook URL for notifications                       |                                              |
| BANNEDSTORES         | Stores to exclude from monitoring                   | `BANNEDSTORES=Los Gatos,Palo Alto`           |
| HANDLEEXCEPTIONDELAY | Delay before handling an exception (in milliseconds)| `HANDLEEXCEPTIONDELAY=3000`                  |
| NORMALMONITORDELAY   | Normal delay between monitoring cycles (in milliseconds) | `NORMALMONITORDELAY=1000`                |
| NOTIFICATIONTIMEOUT  | Timeout for sending notifications (in milliseconds) | `NOTIFICATIONTIMEOUT=15000`                 |

## Usage

To run the program, run

```
cd src
node .
```

## Notification Example

![Notification](https://cdn.discordapp.com/attachments/1022240002408730644/1168028448921497620/image.png)
