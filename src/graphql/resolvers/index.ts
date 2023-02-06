import userResolvers  from './user';
import merge from 'lodash.merge';
import conversationResolvers from './conversation';
import messageResolvers from './message';
const resolvers = merge({}, userResolvers,conversationResolvers,messageResolvers);

export default resolvers;