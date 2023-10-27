# Apple Webstore Monitor

Monitor that checks the availability of Apple products in stores and sending a Discord notification when the product(s) are in stock

## Features

* Monitor multiple products in a given zip code

* Proper error handling

* HTTP proxy support

* Notifications using Discord webhooks

* Supports United States, United Kingdom, Canada and Australia

* Ability to remove certain stores from being checked

## Installation

Install NPM packages
```sh
npm install
```

Run program
```sh
npm start
```

Setup the spreadsheet data.csv accordingly

Example data

```csv
country,products,maxDistance,zip,webhookURL,bannedStores,handleExceptionDelay,normalMonitorDelay,notificationTimeout
us,"MU683LL/A,MU683LL/A,MU663LL/A,MU693LL/A",25,95121,,"Los Gatos,Palo Alto",3000,1000,15000
```

Multiple products/models & Removing multiple stores is supported, seperated by (",")

# Notification Example

![Notification](https://cdn.discordapp.com/attachments/1152077130201571410/1166870194858229860/image.png)