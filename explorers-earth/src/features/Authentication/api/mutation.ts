import { gql } from "@apollo/client";

// register query for graphql
export const registerQuery = gql`
  mutation register($input: UsersPermissionsRegisterInput!) {
    register(input: $input) {
      jwt
      user {
        id
        username
        email
        documentId
        blocked
      }
    }
  }
`;

// login query for graphql
export const loginQuery = gql`
  mutation login($input: UsersPermissionsLoginInput!) {
    login(input: $input) {
      jwt
      user {
        id
        blocked
        username
        email
        documentId
      }
    }
  }
`;

// forgot password mutation
export const forgotPasswordMutation = gql`
  mutation forgotPassword($email: String!) {
    forgotPassword(email: $email) {
      ok
    }
  }
`;

export const resetPasswordMutation = gql`
  mutation Mutation($password: String!, $passwordConfirmation: String!, $code: String!) {
  resetPassword(password: $password, passwordConfirmation: $passwordConfirmation, code: $code) {
    jwt
    user {
      email
      role {
        name
        type
        id
      }
      id
      documentId
      confirmed
      blocked
    }
  }
}
`;