import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js'

const USER_POOL_ID = typeof __COGNITO_USER_POOL_ID__ !== 'undefined' ? __COGNITO_USER_POOL_ID__ : ''
const CLIENT_ID    = typeof __COGNITO_CLIENT_ID__    !== 'undefined' ? __COGNITO_CLIENT_ID__    : ''

const userPool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })

export function getCurrentCognitoUser() {
  return userPool.getCurrentUser()
}

export function getSession() {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser()
    if (!user) return reject(new Error('No current user'))
    user.getSession((err, session) => {
      if (err || !session?.isValid()) return reject(err || new Error('Invalid session'))
      resolve(session)
    })
  })
}

export function cognitoLogin(email, password) {
  const normEmail = email.trim().toLowerCase()
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: normEmail, Pool: userPool })
    const authDetails = new AuthenticationDetails({ Username: normEmail, Password: password })
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve({ type: 'authenticated', session }),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => resolve({ type: 'new_password_required', cognitoUser: user }),
    })
  })
}

export function completeNewPassword(cognitoUser, newPassword, requiredAttributes = {}) {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, requiredAttributes, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    })
  })
}

export function cognitoChangePassword(oldPassword, newPassword) {
  return new Promise((resolve, reject) => {
    const user = userPool.getCurrentUser()
    if (!user) return reject(new Error('No current user'))
    user.getSession((err, session) => {
      if (err || !session?.isValid()) return reject(err || new Error('Invalid session'))
      user.changePassword(oldPassword, newPassword, (err2, result) => {
        if (err2) return reject(err2)
        resolve(result)
      })
    })
  })
}

export function cognitoLogout() {
  const user = userPool.getCurrentUser()
  if (user) user.signOut()
}
