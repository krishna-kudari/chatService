import prisma from "../../lib/prismadb";
import {
  ConversationPopulated,
  createUsernameResponse,
  GraphQLContext,
} from "../../util/types";
import { GraphQLError } from "graphql";
import { Conversation, Prisma, User } from "@prisma/client/index";
import { withFilter } from "graphql-subscriptions";
const resolvers = {
  Query: {
    conversations: async (
      _: any,
      __: any,
      context: GraphQLContext
    ): Promise<Array<ConversationPopulated>> => {
      console.log("CONVERSATIONS QUERY🚧");
      const { session } = context;

      if (!session?.user) {
        throw new Error("Not authorized!");
      }

      const {
        user: { id: userId },
      } = session;
      try {
        const conversations = await prisma.conversation.findMany({
          where: {
            participants: {
              some: {
                userId: {
                  equals: userId,
                },
              },
            },
          },
          include: conversationPopulated,
        });
        // if the query doesn't work query all conversations and filter them
        console.log("Conversations:🎫🧾🎫", conversations);
        return conversations;
      } catch (error: any) {
        console.log("Conversations error", error);
        throw new GraphQLError(error?.message);
      }
    },
  },
  Mutation: {
    createConversation: async (
      _: any,
      args: { participantIds: Array<string> },
      context: GraphQLContext
    ): Promise<{ conversationId: string }> => {
      console.log("INSIDE CREATE CONVERSATION🙋‍♂️");
      const { participantIds } = args;
      const { session, pubsub } = context;

      if (!session?.user) {
        throw new GraphQLError("Not authorized");
      }

      const {
        user: { id: userId },
      } = session;

      try {
        const conversation = await prisma.conversation.create({
          data: {
            participants: {
              createMany: {
                data: participantIds.map((id) => ({
                  hasSeenLatestMessage: id === userId,
                  userId: id,
                })),
              },
            },
          },
          include: conversationPopulated,
        });

        // emit a CONVERSATION_CREATED event using pubsub
        pubsub.publish("CONVERSATION_CREATED", {
          conversationCreated: conversation,
        });
        return {
          conversationId: conversation.id,
        };
      } catch (error: any) {
        console.log("CreateConversation errror", error);
        throw new GraphQLError(error.message);
      }
    },
  },

  Subscription: {
    conversationCreated: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { session, pubsub } = context;
          return pubsub.asyncIterator(["CONVERSATION_CREATED"]);
        },
        (
          payload: ConversationCreatedSubscriptionPayload,
          _: any,
          context: GraphQLContext
        ) => {
          console.log("PAyLOAD:", payload);
          const { session } = context;

          const {
            conversationCreated: { participants },
          } = payload;

          const userIsParticipnat = !!participants.find(
            (p) => p.userId === session?.user?.id
          );
          return userIsParticipnat;

        }
      ),
    },
  },
};

export interface ConversationCreatedSubscriptionPayload {
  conversationCreated: ConversationPopulated;
}
export const participantPopulated =
  Prisma.validator<Prisma.ConversationParticipantInclude>()({
    user: {
      select: {
        id: true,
        username: true,
      },
    },
  });

export const conversationPopulated =
  Prisma.validator<Prisma.ConversationInclude>()({
    participants: {
      include: participantPopulated,
    },
    latestMessage: {
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    },
  });

export default resolvers;
