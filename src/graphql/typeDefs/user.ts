import gql from 'graphql-tag';

const typeDefs = gql`

  type User{
    id: String
    username: String
    email: String
    emailVerified: Boolean
    image: String
    name: String
  }
  type SearchedUser {
    id: String
    username: String
  }

  type Query {
    searchUsers(username: String): [SearchedUser]
  }

  type Mutation {
    createUsername(username: String): createUsernameResponse
  }

  type createUsernameResponse {
    success: Boolean
    error: String
  }
`;

export default typeDefs;
