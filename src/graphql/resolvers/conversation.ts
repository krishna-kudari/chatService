import prisma from "../../lib/prismadb";
import {
  ConversationPopulated,
  ConversationUpdatedSubscriptionPayload,
  ConversationDeletedSubscriptionPayload,
  GraphQLContext,
} from "../../util/types";
import { GraphQLError } from "graphql";
import { Prisma } from ".prisma/client/index";
import { withFilter } from "graphql-subscriptions";
import { userIsConversationParticipant } from "../../util/functions";

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

    markConversationAsRead: async function (
      _: any,
      args: { userId: string; conversationId: string },
      context: GraphQLContext
    ): Promise<boolean> {
      const { session } = context;
      const { userId, conversationId } = args;

      if (!session?.user) {
        throw new Error("Not authorized");
      }
      try {
        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            userId,
            conversationId,
          },
        });
        /**
         * Should always exists but being safe
         */

        if (!participant) {
          throw new Error("Participant entity not found");
        }

        await prisma.conversationParticipant.update({
          where: {
            id: participant.id,
          },
          data: {
            hasSeenLatestMessage: true,
          },
        });
      } catch (error: any) {
        console.log("markConversationASREAD ERROR✅❗", error);
        throw new GraphQLError(error?.message);
      }
      return true;
    },

    deleteConversation: async (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      const { session, pubsub } = context;
      const { conversationId } = args;

      if (!session?.user) {
        throw new Error("Not Authorized");
      }

      try {
        /**
         * Delete conversation adnd all related documents
         */
        const [deletedConversation] = await prisma.$transaction([
          prisma.conversation.delete({
            where: {
              id: conversationId,
            },
            include: conversationPopulated,
          }),
          prisma.conversationParticipant.deleteMany({
            where: {
              conversationId,
            },
          }),
          prisma.message.deleteMany({
            where: {
              conversationId,
            },
          }),
        ]);

        pubsub.publish("CONVERSATION_DELETED", {
          conversationDeleted: deletedConversation,
        });
        console.log("CONVERSATION_DELETED EVENT ⚡🚮⚡");
      } catch (error: any) {
        console.log("DELETECONVERSATION ERROR:🚮🗑️", error);
        throw new GraphQLError(error.message);
      }

      return true;
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

          console.log("HERE IS UPDATE CONVERSATION PAYLOAD📦📦", payload);

          if (!session?.user) {
            throw new Error("Not authorized");
          }

          const {
            conversationCreated: { participants },
          } = payload;

          const userIsParticipant = userIsConversationParticipant(
            participants,
            session.user.id
          );

          return userIsParticipant;
        }
      ),
    },

    conversationUpdated: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { session, pubsub } = context;
          return pubsub.asyncIterator(["CONVERSATION_UPDATED"]);
        },
        (
          payload: ConversationUpdatedSubscriptionPayload,
          _: any,
          context: GraphQLContext
        ) => {
          console.log("PAyLOAD:", payload);
          const { session } = context;

          if (!session?.user) {
            throw new Error("Not authorized");
          }

          const {
            conversationUpdated: {
              conversation: { participants },
            },
          } = payload;

          const userIsParticipant = userIsConversationParticipant(
            participants,
            session.user.id
          );

          return userIsParticipant;
        }
      ),
    },

    conversationDeleted: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { session, pubsub } = context;
          return pubsub.asyncIterator(["CONVERSATION_DELETED"]);
        },
        (
          payload: ConversationDeletedSubscriptionPayload,
          _: any,
          context: GraphQLContext
        ) => {
          console.log("PAyLOAD:", payload);
          const { session } = context;

          if (!session?.user) {
            throw new Error("Not authorized");
          }
          
          const {
            conversationDeleted: {participants},
          } = payload;

          return userIsConversationParticipant(participants, session.user.id);
        }
      ),
    }
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
