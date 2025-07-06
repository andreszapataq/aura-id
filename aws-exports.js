// aws-exports.js
const awsmobile = {
    "aws_project_region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
    "aws_cognito_identity_pool_id": process.env.NEXT_PUBLIC_AWS_IDENTITY_POOL_ID || "",
    "aws_cognito_region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
    "aws_user_pools_id": "",
    "aws_user_pools_web_client_id": "",
    "oauth": {},
    "federationTarget": "COGNITO_IDENTITY_POOLS",
    "aws_cognito_username_attributes": [],
    "aws_cognito_social_providers": [],
    "aws_cognito_signup_attributes": [],
    "aws_cognito_mfa_configuration": "OFF",
    "aws_cognito_mfa_types": [],
    "aws_cognito_password_protection_settings": {
        "passwordPolicyMinLength": 8,
        "passwordPolicyCharacters": []
    },
    "aws_cognito_verification_mechanisms": [],
    "predictions": {
        "interpret": {
            "interpretText": {
                "region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
                "proxy": false,
                "defaults": {
                    "type": "ALL"
                }
            }
        },
        "convert": {
            "translateText": {
                "region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
                "proxy": false,
                "defaults": {
                    "sourceLanguage": "en",
                    "targetLanguage": "zh"
                }
            },
            "speechGenerator": {
                "region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
                "proxy": false,
                "defaults": {
                    "VoiceId": "Ivy",
                    "LanguageCode": "en-US"
                }
            },
            "transcription": {
                "region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
                "proxy": false,
                "defaults": {
                    "language": "en-US"
                }
            }
        },
        "identify": {
            "identifyText": {
                "proxy": false,
                "region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
                "defaults": {
                    "format": "PLAIN"
                }
            },
            "identifyLabels": {
                "proxy": false,
                "region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
                "defaults": {
                    "type": "LABELS"
                }
            },
            "identifyEntities": {
                "proxy": false,
                "region": process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
                "celebrityDetectionEnabled": true,
                "defaults": {
                    "collectionId": process.env.AWS_REKOGNITION_COLLECTION_ID || "EmployeesFaces",
                    "maxEntities": 50
                }
            }
        }
    }
};

export default awsmobile;