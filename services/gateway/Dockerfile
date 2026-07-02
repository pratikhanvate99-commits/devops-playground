FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 5000

# Use node --expose-gc to allow garbage collection to run if memory leak stopped
CMD [ "node", "--expose-gc", "index.js" ]
