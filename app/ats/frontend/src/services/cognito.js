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
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool })
    const authDetails = new AuthenticationDetails({ Username: email, Password: password })
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error('Password change required — use the AWS Console to set a permanent password.')),
    })
  })
}

export function cognitoLogout() {
  const user = userPool.getCurrentUser()
  if (user) user.signOut()
}
