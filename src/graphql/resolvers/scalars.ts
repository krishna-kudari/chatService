import { GraphQLScalarType, Kind } from "graphql";

const dateScalar = new GraphQLScalarType({
  name: "Date",
  description: "Date custom scalar type",
  serialize(value: any) {
    return value.getTime(); //converting outgoing date to  integer for JSON
  },
  parseValue(value: any) {
    return new Date(value); // convert incoming integer to Date
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10)); // Convert hard-coded AST string
    }
    return null; // Invalid hard-coded value {not an integer}
  },
});

const resolvers = {
    Date: dateScalar,
}

export default resolvers;