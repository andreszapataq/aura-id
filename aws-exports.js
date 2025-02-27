// aws-exports.js
const awsmobile = {
    "aws_project_region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
    "aws_cognito_identity_pool_id": process.env.NEXT_PUBLIC_AWS_IDENTITY_POOL_ID || ""
};

export default awsmobile;