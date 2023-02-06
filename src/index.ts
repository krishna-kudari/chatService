import { makeExecutableSchema } from "@graphql-tools/schema";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@apollo/server/express4";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import * as dotenv from "dotenv";
import express from "express";
import http from "http";
import { getSession } from "next-auth/react";
import resolvers from "./graphql/resolvers";
import typeDefs from "./graphql/typeDefs";
import { PubSub } from "graphql-subscriptions";
import { GraphQLContext, Session, SubscriptionContext } from "./util/types";
import prisma from "./lib/prismadb";
import cors from "cors";
import { json } from "body-parser";
async function main() {
  dotenv.config();
  const app = express();
  const httpServer = http.createServer(app);

  // Creating the WebSocket server
  const wsServer = new WebSocketServer({
    // This is the `httpServer` we created in a previous step.
    server: httpServer,
    // Pass a different path here if your ApolloServer serves at
    // a different path.
    path: "/graphql/subscriptions",
  });

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const pubsub = new PubSub();
  // Hand in the schema we just created and have the
  // WebSocketServer start listening.
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx: SubscriptionContext): Promise<GraphQLContext> => {
        if (ctx.connectionParams && ctx.connectionParams.session) {
          const { session } = ctx.connectionParams;
          return { session, pubsub };
        }
        return { session: null, pubsub };
      },
    },
    wsServer
  );

  const corsOptions = {
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  };

  // // context parameters
  // const prismaclient = prisma;
  // pubsub
  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    // context: async ({ req, res }): Promise<GraphQLContext> => {
    //   const session = (await getSession({ req })) as Session; //added "const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));" to next-auth client util.js to work
    //   // console.log("REQ :",req.headers);
    //   // console.log("RES :",res);

    //   // const session = await getSession({req});
    //   console.log("SESSION FROM CONTEXT", session);
    //   return { session, pubsub };
    // },
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),

      // Proper shutdown for the WebSocket server.
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
      // ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });
  await server.start();
  // server.applyMiddleware({ app, cors: corsOptions });
  app.use(
    "/graphql",
    cors<cors.CorsRequest>(corsOptions),
    json(),
    expressMiddleware(server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        const session = await getSession({ req });//added "const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));" to next-auth client util.js to work

        return { session: session as Session, pubsub };
      },
    })
  );
  // await new Promise<void>((resolve) =>
  //   httpServer.listen({ port: 4000 }, resolve)
  // );
  const PORT = 4000;
  await new Promise<void>((resolve) =>
    httpServer.listen({ port: PORT }, resolve)
  );
  console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
}

main().catch((err) => console.log(err));
