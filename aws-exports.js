// aws-exports.js
const awsmobile = {
    "aws_project_region": "TU_REGION",
    "aws_cognito_identity_pool_id": "us-east-1:513c2f56-2481-4de0-9c71-105125c646be",
    "aws_cognito_region": "TU_REGION",
    "aws_user_pools_id": "TU_USER_POOLS_ID", // Si usas autenticación de usuario
    "aws_user_pools_web_client_id": "TU_USER_POOLS_WEB_CLIENT_ID", // Si usas autenticación de usuario
    "aws_appsync_graphqlEndpoint": "TU_APPSYNC_ENDPOINT", // Si usas AppSync
    "aws_appsync_region": "TU_REGION", // Si usas AppSync
    "aws_appsync_authenticationType": "API_KEY", // Si usas AppSync
    "aws_appsync_apiKey": "TU_API_KEY", // Si usas AppSync
    "aws_user_files_s3_bucket": "TU_S3_BUCKET_NAME", // Si usas S3
    "aws_user_files_s3_bucket_region": "TU_REGION" // Si usas S3
};

export default awsmobile;