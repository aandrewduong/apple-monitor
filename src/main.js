'use strict'

import got from "got";
import tunnel from "tunnel";
import fs from "fs";
import path from "path";
import winston from "winston";
import csvparser from "csv-parser";

const readFile = (path, splitter = '\r\n') => fs.readFileSync(path, "utf-8").split(splitter);

const logger = winston.createLogger({
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "apple-monitor.log" }),
    ]
});

const handleError = (exception, callback, args, handleExceptionDelay) => {
    logger.error(exception);
    return setTimeout(() => callback(...args), Math.floor(1000 + Math.random() * (handleExceptionDelay - 1000 + 1)));
}

const getAgentFromProxy = (httpProxy) => {
    const [host, port, user, password] = httpProxy.split(":");
    return {
        https: tunnel.httpsOverHttp({
            proxy: {
                host: host,
                port: port,
                proxyAuth: `${user}:${password}`
            }
        })
    };
}

const getProductDetails = async(country, product, httpProxy) => {
    try {
        logger.info("Getting product details");
        const queryString = {
            product: product,
            refererUrl: `https://www.apple.com/${country}/shop`
        }
        const encodedQueryString = encodeURIComponent(JSON.stringify(queryString));
        const productDetailsUrl = `https://www.apple.com/${country}/shop/updateSEO?m=${encodedQueryString}`;
        const httpRequestOptions = {
            method: "GET",
            timeout: { request: 5000 },
            url: productDetailsUrl,
            headers: {
                "Accept": "application/json",
                "Accept-Language": "en-US,en,q=0.9",
                "Pragma": "no-cache",
                "User-Agent": "Googlebot"
            },
            responseType: "json",
            agent: httpProxy ? getAgentFromProxy(httpProxy) : undefined
        };
        const httpResponse = await got(httpRequestOptions);
        logger.info(`HTTP response status code: ${httpResponse.statusCode}`);
        const { body } = httpResponse.body;
        if (!body) {
            logger.warn("No product image found from updateSEO");
            return null;
        }
        const { marketingData } = body;
        const { microdataList } = marketingData;
        const microdata = JSON.parse(microdataList[0]);
        const { image, offers } = microdata;
        const offer = offers[0];
        const { priceCurrency, price } = offer;
        return { image, priceCurrency, price };
    } catch (exception) {
        logger.error(exception);
    }
}

const notificationHistory = new Map(); 

const sendNotification = async (product, productUrl, country, twoLineAddress, locale, state, storePickupProductTitle, storeImageUrl, store, storePickupQuote, distanceWithUnit, webhookURL, httpProxy, notificationTimeout ) => {
    try {
        if (!webhookURL) {
            logger.warning("No webhookURL set");
            return;
        }
        const notificationKey = `${storePickupProductTitle}_${store}_${storePickupQuote}`;
        const lastNotificationInfo = notificationHistory.get(notificationKey);
        const currentTime = new Date().getTime();

        if (lastNotificationInfo) {
            const { availability: lastAvailability, timestamp } = lastNotificationInfo;
            const elapsedTime = currentTime - timestamp; 
            if (storePickupQuote == lastAvailability && notificationTimeout > elapsedTime) {
                return;
            }
            notificationHistory.delete(notificationKey);
        }
        notificationHistory.set(notificationKey, { availability: storePickupQuote, timestamp: currentTime });
        let  { image, priceCurrency, price } = await getProductDetails(country, product, httpProxy);
        if (!image) {
            image = storeImageUrl;
        }

        logger.info(`Sending notification ${storePickupProductTitle} - ${storePickupQuote}`);
        const webhookPayload = {
            username: "apple-monitor",
                embeds: [
                    {
                        title: `${storePickupProductTitle}`,
                        description: `${storePickupQuote}`,
                        url: productUrl,
                        color: storePickupQuote == "Apple Store Pickup is currently unavailable" || storePickupQuote.includes("Currently unavailable") ? 16711680 : 65280,
                        fields: [
                            {
                                name: "Store",
                                value: `${twoLineAddress}`,
                                inline: true,
                            },
                            {
                                name: "Distance",
                                value: distanceWithUnit,
                                inline: true,
                            },
                            {
                                name: "SKU",
                                value: product,
                                inline: true,
                            },
                            {
                                name: "Price",
                                value: `${price} ${priceCurrency}`,
                                inline: true,
                            }
                        ],
                        footer: {
                            text: new Date().toLocaleString("en-US", {timeStyle: "full", dateStyle: "medium"})
                        },
                        thumbnail: {
                            url: image,
                        }
                    },
                ],
            }
            const httpRequestHeaders = {
                "Content-Type": "application/json",
            };
            const httpRequestOptions = {
                method: "POST",
                timeout: {
                    request: 5000,
                },
                headers: httpRequestHeaders,
                url: webhookURL,
                json: webhookPayload,
                agent: httpProxy ? getAgentFromProxy(httpProxy) : undefined
            }
            await got(httpRequestOptions);
    } catch (exception) {
        return;
    }
}

const UNAVAILABLE_MESSAGES = new Set([
    "Currently unavailable",
    "Unavailable for pickup at",
    "Apple Store Pickup is currently unavailable",
    "In-store availability on"
]);

const checkStoreAvailability = async (store, bannedStores, _country, maxDistance, products, webhookURL, httpProxy, notificationTimeout) => {
    try {
        const {storedistance, storeName, state, storeImageUrl, country, retailStore, partsAvailability} = store;
        const {distanceWithUnit} = retailStore;
        const { address } = retailStore;
        const { twoLineAddress } = address;
    
        if (storedistance > maxDistance) return;
        if (bannedStores.includes(storeName)) return;
        console.log(store);
        const notifications = await Promise.all(products.map(async product => {
            const shopPath = Math.random() < 0.5 ? `/${_country}-edu/shop` : `/${_country}/shop`;
            const productUrl = `https://www.apple.com${shopPath}/product/${product}`;
    
            const itemAvailability = partsAvailability[product];
            const {messageTypes} = itemAvailability;
            const {regular} = messageTypes;
            const {storePickupProductTitle, storePickupQuote} = regular;
    
            console.log(storePickupProductTitle, storePickupQuote);
            if (Array.from(UNAVAILABLE_MESSAGES).some(message => storePickupQuote.includes(message))) {
                return null;
            }
            return await sendNotification(product, productUrl, _country, twoLineAddress, country, state, storePickupProductTitle, storeImageUrl, storeName, storePickupQuote, distanceWithUnit, webhookURL, httpProxy, notificationTimeout);
        }));
        return notifications.filter(notification => notification !== null);
    } catch (exception) {
        handleError(exception, checkStoreAvailability, [store, bannedStores, _country, maxDistance, products, webhookURL, httpProxy, notificationTimeout], 0);
    }
}

const getStoresAndErrorMessage = (body, endPoint, handleExceptionDelay) => {
    try {
        switch (endPoint) {
            case "/retail/pickup-message":
                return body;
            case "/fulfillment-messages":
                return body.content.pickupMessage;
            default: {
                throw new Error("Invalid endpoint");
            }
        }
    } catch (exception) {
        handleError(exception, getStoresAndErrorMessage, [body, endPoint, handleExceptionDelay], handleExceptionDelay);        
    }
}

const checkProductAvailability = async (country, products, maxDistance, zip, webhookURL, bannedStores, proxies, handleExceptionDelay, normalMonitorDelay, notificationTimeout) => {
    try {
        if (!zip) {
            logger.error("No zip code given");
            return;
        }
        logger.info("Checking product availability for products: " + products);

        const httpProxy = proxies[Math.floor(Math.random() * proxies.length)];
        const partsUrlQuery = Object.entries(products)
            .map(([product, value]) => `parts.${product}=${value}`)
            .join('&');
        const shopPath = Math.random() < 0.5 ? `/${country}-edu/shop` : `/${country}/shop`;
        const endPoint = Math.random() < 0.5 ? `/retail/pickup-message` : `/fulfillment-messages`;
        const fulfillmentMessageRequestUrl = `https://www.apple.com${shopPath}${endPoint}?pl=true&mts.0=regular&${partsUrlQuery}&location=${zip}`;

        console.log(fulfillmentMessageRequestUrl);
        const httpRequestOptions = {
            method: "GET",
            timeout: { request: 5000 },
            url: fulfillmentMessageRequestUrl,
            headers: {
                "Accept": "application/json",
                "Accept-Language": "en-US,en,q=0.9",
                "Pragma": "no-cache",
                "User-Agent": "Googlebot"
            },
            responseType: "json",
            agent: httpProxy ? getAgentFromProxy(httpProxy) : undefined
        };

        const httpResponse = await got(httpRequestOptions);
        logger.info(`HTTP response status code: ${httpResponse.statusCode}`);

        const { body } = httpResponse.body;
        const { stores, errorMessage } = getStoresAndErrorMessage(body, endPoint, handleExceptionDelay);
        if (errorMessage) {
            logger.warn(errorMessage);
            return setTimeout(
                () => checkProductAvailability(country, products, maxDistance, zip, webhookURL, bannedStores, proxies, handleExceptionDelay, normalMonitorDelay, notificationTimeout), 
                Math.floor(1000 + Math.random() * (normalMonitorDelay - 1000 + 1))
            );
        }
        await Promise.all(stores.map(store => 
            checkStoreAvailability(store, bannedStores, country, maxDistance, products, webhookURL, httpProxy, notificationTimeout)
        ));
        setTimeout(
            () => checkProductAvailability(country, products, maxDistance, zip, webhookURL, bannedStores, proxies, handleExceptionDelay, normalMonitorDelay, notificationTimeout), 
            Math.floor(1000 + Math.random() * (normalMonitorDelay - 1000 + 1))
        );
    } catch (exception) {
        handleError(exception, checkProductAvailability, [country, products, maxDistance, zip, webhookURL, bannedStores, proxies, handleExceptionDelay, normalMonitorDelay, notificationTimeout], handleExceptionDelay);
    }
}

const getProducts = async(country, family, _dimensionCapacity, _carrierModel, _dimensionScreensize) => {
    try {
        console.log("Getting products");
        const productDetailsUrl = `https://www.apple.com/${country}/shop/product-locator-meta?family=${family}`;
        const httpRequestOptions = {
            method: "GET",
            timeout: { request: 5000 },
            url: productDetailsUrl,
            headers: {
                "Accept": "application/json",
                "Accept-Language": "en-US,en,q=0.9",
                "Pragma": "no-cache",
                "User-Agent": "Googlebot"
            },
            responseType: "json",
        };
        const httpResponse = await got(httpRequestOptions);
        const { body } = httpResponse.body;
        const { productLocatorOverlayData } = body;
        const { productLocatorMeta } = productLocatorOverlayData;
        const { products } = productLocatorMeta;
        
        const matchingProducts = products.filter(product => {
            return _dimensionCapacity.includes(product.dimensionCapacity)
                && product.dimensionScreensize === _dimensionScreensize
                && (_carrierModel === "N/A" || product.carrierModel === _carrierModel);
        });

        const _products = [];
        await Promise.all(matchingProducts.map(product => {
            _products.push(product.partNumber);
        }));

        return _products;
    } catch (exception) {
        console.log(exception);
    }
}

const mainInit = async () => {
    logger.info("Initializing app");

    const paths = [
        "../proxies.txt",
    ].map(filePath => path.join(filePath));

    paths.forEach(filePath => {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "", "utf-8");
            logger.info(filePath + " not found, created file");
        }
    })

    const [proxies] = paths.map((filePath, index) => 
        (index === 2) ? fs.readFileSync(filePath, "utf-8") : readFile(filePath)
    );
    fs.createReadStream("../data.csv")
    .pipe(csvparser())
    .on('data', async (row) => {
        const { channelid,country,useFamily,products,family,maxDistance,zip,webhookURL,bannedStores,handleExceptionDelay,normalMonitorDelay,notificationTimeout } = row;
        const _products = products.includes(",") ? products.split(",").map(product => product.trim()) : [products.trim()];
        const _bannedStores = bannedStores.includes(",") ? bannedStores.split(",").map(bannedStore => bannedStore.trim()) : [bannedStores.trim()];
        if (useFamily) {
            if (family.length > 0) {
                const [ model, dimensionCapacity, carrierModel, dimensionScreensize ] = family.includes(",") ? family.split(",").map(family => family.trim()) : [family.trim()];
                const _dimensionCapacity = dimensionCapacity.includes("+") ? dimensionCapacity.split("+").map(dimensionCapacity => dimensionCapacity.trim()) : [dimensionCapacity.trim()];
                const __products = await getProducts(country, model, _dimensionCapacity, carrierModel, dimensionScreensize);
                checkProductAvailability(country, __products,maxDistance,zip,webhookURL,_bannedStores, proxies, handleExceptionDelay,normalMonitorDelay,notificationTimeout);            
            }
        } else {
            checkProductAvailability(country, _products,maxDistance,zip,webhookURL,_bannedStores, proxies, handleExceptionDelay,normalMonitorDelay,notificationTimeout);            
        }
    });
}

mainInit();