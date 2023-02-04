import userResolvers  from './user';
import merge from 'lodash.merge';
import conversationResolver from './conversation';

const resolvers = merge({}, userResolvers,conversationResolver);

export default resolvers;