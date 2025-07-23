/*
* <license header>
*/

/**
 * This is a sample action showcasing how to query API MESH
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs, getAdminToken } = require('../utils')
const fetch = require('node-fetch')

// main function that will be executed by Adobe I/O Runtime
async function main(params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['query']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }

    // Get admin token for Commerce
    const adminToken = await getAdminToken()
    
    // Add admin token to headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }

    // Forward store header if present
    if (params.__ow_headers && params.__ow_headers.store) {
      headers.Store = params.__ow_headers.store
    }

    const response = await fetch(process.env.COMMERCE_BASE_URL + '/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: params.query,
        variables: params.variables || {}
      })
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}: ${response.statusText}`)
    }

    const content = await response.json()
    return {
      statusCode: 200,
      body: content
    }
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'Server error', logger)
  }
}

exports.main = main
