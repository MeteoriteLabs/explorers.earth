/**
 * GraphQL Mutations - LocalQR Auth Model
 * Authentication mutations for Strapi UsersPermissions
 */

import { gql } from '@apollo/client';

// Login mutation
export const LOGIN_MUTATION = gql`
  mutation login($input: UsersPermissionsLoginInput!) {
    login(input: $input) {
      jwt
      user {
        id
        documentId
        username
        email
        blocked
      }
    }
  }
`;

// Register mutation
export const REGISTER_MUTATION = gql`
  mutation register($input: UsersPermissionsRegisterInput!) {
    register(input: $input) {
      jwt
      user {
        id
        documentId
        username
        email
        blocked
      }
    }
  }
`;

// Forgot password mutation
export const FORGOT_PASSWORD_MUTATION = gql`
  mutation forgotPassword($email: String!) {
    forgotPassword(email: $email) {
      ok
    }
  }
`;

// Reset password mutation
export const RESET_PASSWORD_MUTATION = gql`
  mutation resetPassword($password: String!, $passwordConfirmation: String!, $code: String!) {
    resetPassword(
      password: $password
      passwordConfirmation: $passwordConfirmation
      code: $code
    ) {
      jwt
      user {
        id
        documentId
        username
        email
        blocked
      }
    }
  }
`;

// Check username availability query
export const CHECK_USERNAME_AVAILABILITY = gql`
  query CheckUsernameAvailability($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      data {
        id
      }
    }
  }
`;
