import { Prisma } from ".prisma/client/index";
import { GraphQLError } from "graphql";
import { withFilter } from "graphql-subscriptions";
import prisma from "../../lib/prismadb";
import { userIsConversationParticipant } from "../../util/functions";
import {
  ConversationPopulated,
  createUsernameResponse,
  GraphQLContext,
  MessagePopulated,
  MessageSentSubscriptionPayload,
  sendMessageArguments,
} from "../../util/types";
import { conversationPopulated } from "./conversation";

const resolvers = {
  Query: {
    messages: async function (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ): Promise<Array<MessagePopulated>> {
      const { session } = context;
      const { conversationId } = args;

      if (!session?.user) {
        throw new GraphQLError("Not authorized");
      }

      const {
        user: { id: userId },
      } = session;
      /**
       * Verify that conversation exist and user is a participant
       */
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
        include: conversationPopulated,
      });
      if (!conversation) {
        throw new GraphQLError("conversation Not Found");
      }
      const allowedToview = userIsConversationParticipant(
        conversation.participants,
        userId
      );

      if (!allowedToview) {
        throw new GraphQLError("Not authorized");
      }

      try {
        const messages = await prisma.message.findMany({
          where: {
            conversationId,
          },
          include: messagePopulated,
          orderBy: {
            createdAt: "desc",
          },
        });
        // return [ {body: "Here is the new Message"} as MessagePopulated]
        return messages;
      } catch (error: any) {
        console.log("Messages Error", error);
        throw new GraphQLError(error.message);
      }
      return [];
    },
  },
  Mutation: {
    sendMessage: async (
      _: any,
      args: sendMessageArguments,
      context: GraphQLContext
    ): Promise<boolean> => {
      const { session, pubsub } = context;
      if (!session?.user) {
        throw new GraphQLError("Not authorized");
      }

      const {
        user: { id: userId },
      } = session;
      const { id: messageId, senderId, conversationId, body } = args;

      if (userId !== senderId) throw new GraphQLError("Not authorized");

      console.log("INSIDE SENDMESSAGE RESOLVER📤");

      try {
        /**
         * Create new Message entity
         */

        const newMessage = await prisma.message.create({
          data: {
            id: messageId,
            senderId,
            conversationId,
            body,
          },
          include: messagePopulated,
        });
        /**
         * Find ConversationParticipant entity
         */
        const participant = await prisma.conversationParticipant.findFirst({
          where : {
            userId,
            conversationId,
          }
        });

        if(!participant) {
          throw new GraphQLError('Participanr does not exist');
        }
        /**
         * Update conversation entity
         */

        const conversation = await prisma.conversation.update({
          where: {
            id: conversationId,
          },
          data: {
            latestMessageId: newMessage.id,
            participants: {
              update: {
                where: {
                  id: participant.id,
                },
                data: {
                  hasSeenLatestMessage: true,
                },
              },
              updateMany: {
                where: {
                  NOT: {
                    userId,
                  },
                },
                data: {
                  hasSeenLatestMessage: false,
                },
              },
            },
          },
          include: conversationPopulated,
        });
        console.log("MESSAGE HAS BEEN ADDED TO CONVERSATION📬🆗",conversation);
        
        /**
         * Subscribe events for participants of the conversation
         */
        pubsub.publish("MESSAGE_SENT", { messageSent: newMessage });
        console.log("MESSAGE SENT EVENT⚡⚡");
        pubsub.publish("CONVERSATION_UPDATED", {
          conversationUpdated: {
            conversation,
          },
        });
        console.log("CONVERSATION_UPDATED EVENT ⚡⚡");
        
      } catch (error: any) {
        console.log("SEND_MESSAGE ERROR: ", error);
        throw new GraphQLError(error.message);
      }
      return true;
    },
  },
  Subscription: {
    messageSent: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;
          return pubsub.asyncIterator(["MESSAGE_SENT"]);
        },
        (
          payload: MessageSentSubscriptionPayload,
          args: { conversationId: string },
          context: GraphQLContext
        ): boolean => {
          const { session } = context;
          return payload.messageSent.conversationId === args.conversationId;
        }
      ),
    },
  },
};

export const messagePopulated = Prisma.validator<Prisma.MessageInclude>()({
  sender: {
    select: {
      id: true,
      username: true,
    },
  },
});

export default resolvers;
