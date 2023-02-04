import prisma from "../../lib/prismadb";
import { createUsernameResponse, GraphQLContext } from "../../util/types";
import { GraphQLError } from "graphql";
import { User } from "@prisma/client";
const resolvers = {
  Query: {
    searchUsers: async (
      _: any,
      args: { username: string },
      context: GraphQLContext
    ): Promise<Array<User>> => {
      console.log("INSIDE SEARCH USERS RESOLVER:⛺");
      const { username: searchedUsername } = args;
      const { session } = context;
      if (!session?.user) {
        throw new GraphQLError("Not authorized");
      }
      console.log("SEARCHED USERNAME:🔤",searchedUsername);
      
      const {
        user: { username: myUsername },
      } = session;

      try {
        const users = await prisma.user.findMany({
          where: {
            username: {
              contains: searchedUsername,
              not: myUsername,
              mode: "insensitive",
            },
          },
        });
        console.log("SEARCHED USERS🅰️",users);
        return users;
      } catch (error: any) {
        console.log("SearchUsers error🦀🦀", error);
        throw new GraphQLError(error?.message);
      }
    },
  },
  Mutation: {
    createUsername: async (
      _: any,
      args: { username: string },
      context: GraphQLContext
    ): Promise<createUsernameResponse> => {
      console.log("CREATE USERNAME MUTATION", context);
      const { username } = args;
      const { session } = context;
      console.log("Hey the API", username);
      console.log("here is context", context);
      // console.log("prisma",prisma);
      if (!session?.user) {
        return {
          error: "Not authorized",
        };
      }

      const { id: userId } = session.user;

      try {
        /* 
                Check taht username is not taken
                 */
        const existingUser = await prisma.user.findUnique({
          where: {
            username,
          },
        });
        console.log("ExistingUser", existingUser);

        if (existingUser) {
          return {
            error: "USername already taken. Try anoyher",
          };
        }
        console.log("updating the username");
        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            username,
          },
        });
        console.log("Updated✅");

        return { success: true };
        /* 
                Update username 
                */
      } catch (error: any) {
        console.log("CreateUSername error", error);
        return {
          error: error?.message,
        };
      }
    },
  },
};

export default resolvers;
