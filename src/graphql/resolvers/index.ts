import userResolvers  from './user';
import merge from 'lodash.merge';
import conversationResolvers from './conversation';
import messageResolvers from './message';
import scalarResolvers from "./scalars";
const resolvers = merge({},scalarResolvers, userResolvers,conversationResolvers,messageResolvers);

export default resolvers;