FROM node:14.13.1-slim

ARG BUILD_ENV=production

EXPOSE 8000

WORKDIR /prbot/

COPY package.json yarn.lock ./
RUN npm install --$BUILD_ENV

COPY . /prbot/

CMD ["sh", "-c", "node index "]
