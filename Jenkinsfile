pipeline {

    agent any

    tools {
        nodejs 'NodeJS-20'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
        timeout(time: 45, unit: 'MINUTES')
    }

    triggers {
        githubPush()
    }

    environment {
        APP_NAME = 'nodejs-app'

        NODEJS_SERVER_IP = '13.51.98.92'
        NODEJS_SERVER_USER = 'ec2-user'
        REMOTE_PATH = '/home/ec2-user/nodejs-app'

        NEXUS_URL = 'http://13.61.122.10:8081'
        NEXUS_REPOSITORY = 'nodejs-artifacts'
        ARTIFACT_NAME = "nodejs-app-${BUILD_NUMBER}.tar.gz"
        NEXUS_UPLOAD_PATH = "nodejs-app/${BUILD_NUMBER}/${ARTIFACT_NAME}"

        EMAIL_RECIPIENTS = 'onlytouseandroid@gmail.com'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code from GitHub...'

                git branch: 'main',
                    credentialsId: 'GitHub_Credentials',
                    url: 'https://github.com/AliAutomation/nodejs-app.git'
            }
        }

        stage('Verify Node.js') {
            steps {
                echo 'Verifying Node.js and npm versions...'

                sh '''
                    set -e
                    node --version
                    npm --version
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing dependencies...'

                sh '''
                    set -e
                    npm install
                '''
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo 'Running SonarQube analysis...'

                withSonarQubeEnv('SonarQube-Server') {
                    sh '''
                        set -e
                        npx sonar-scanner
                    '''
                }
            }
        }

        stage('Quality Gate') {
            steps {
                echo 'Waiting for SonarQube Quality Gate result...'

                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build') {
            steps {
                echo 'Running build stage...'

                sh '''
                    set -e
                    npm run build
                '''
            }
        }

        stage('Test') {
            steps {
                echo 'Running test stage...'

                sh '''
                    set -e
                    npm test
                '''
            }
        }

        stage('Package') {
            steps {
                echo 'Creating deployment artifact...'

                sh '''
                    set -e

                    rm -f ${ARTIFACT_NAME}
                    rm -f /tmp/${ARTIFACT_NAME}

                    tar \
                      --exclude=node_modules \
                      --exclude=.git \
                      --exclude=coverage \
                      --exclude="${ARTIFACT_NAME}" \
                      -czf /tmp/${ARTIFACT_NAME} .

                      mv /tmp/${ARTIFACT_NAME} .

                    ls -lh ${ARTIFACT_NAME}
                '''

                archiveArtifacts artifacts: "${ARTIFACT_NAME}", fingerprint: true
            }
        }

        stage('Upload to Nexus') {
            steps {
                echo 'Uploading artifact to Nexus...'

                withCredentials([
                    usernamePassword(
                        credentialsId: 'Nexus_Credentials',
                        usernameVariable: 'NEXUS_USERNAME',
                        passwordVariable: 'NEXUS_PASSWORD'
                    )
                ]) {
                    sh '''
                        set +x
                        set -e

                        curl -u "$NEXUS_USERNAME:$NEXUS_PASSWORD" \
                             --upload-file "${ARTIFACT_NAME}" \
                             "${NEXUS_URL}/repository/${NEXUS_REPOSITORY}/${NEXUS_UPLOAD_PATH}"

                        echo "Artifact uploaded successfully:"
                        echo "${NEXUS_URL}/repository/${NEXUS_REPOSITORY}/${NEXUS_UPLOAD_PATH}"
                    '''
                }
            }
        }

        stage('Deploy via SSH') {
            steps {
                echo 'Deploying application to Node.js EC2 using SSH...'

                sshagent(['NodeJS_Server_SSH_Cred']) {
                    sh '''
                        set -e

                        echo "Creating remote deployment directory..."
                        ssh -o StrictHostKeyChecking=no ${NODEJS_SERVER_USER}@${NODEJS_SERVER_IP} "
                            mkdir -p ${REMOTE_PATH}
                        "

                        echo "Copying artifact to remote server..."
                        scp -o StrictHostKeyChecking=no ${ARTIFACT_NAME} \
                            ${NODEJS_SERVER_USER}@${NODEJS_SERVER_IP}:/tmp/${ARTIFACT_NAME}

                        echo "Extracting artifact and restarting PM2..."
                        ssh -o StrictHostKeyChecking=no ${NODEJS_SERVER_USER}@${NODEJS_SERVER_IP} "
                            set -e

                            cd ${REMOTE_PATH}

                            rm -rf *
                            tar -xzf /tmp/${ARTIFACT_NAME} -C ${REMOTE_PATH}

                            npm install --omit=dev

                            if pm2 describe ${APP_NAME} > /dev/null; then
                                pm2 restart ${APP_NAME} --update-env
                            else
                                pm2 start ecosystem.config.js --name ${APP_NAME}
                            fi

                            pm2 save
                        "
                    '''
                }
            }
        }
    }

    post {

        success {
            echo 'Pipeline completed successfully.'

            emailext(
                mimeType: 'text/html',
                to: "${EMAIL_RECIPIENTS}",
                subject: "SUCCESS: ${env.JOB_NAME} - Build #${env.BUILD_NUMBER}",
                body: """
                    <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2 style="color: green;">Jenkins Build Successful</h2>

                        <p><b>Status:</b> SUCCESS</p>
                        <p><b>Job Name:</b> ${env.JOB_NAME}</p>
                        <p><b>Build Number:</b> #${env.BUILD_NUMBER}</p>
                        <p><b>Build URL:</b> ${env.BUILD_URL}${env.BUILD_URL}</a></p>
                        <p><b>Artifact:</b> ${env.ARTIFACT_NAME}</p>
                    </body>
                    </html>
                """
            )
        }

        failure {
            echo 'Pipeline failed.'

            emailext(
                mimeType: 'text/html',
                to: "${EMAIL_RECIPIENTS}",
                attachLog: true,
                compressLog: true,
                subject: "FAILED: ${env.JOB_NAME} - Build #${env.BUILD_NUMBER}",
                body: """
                    <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2 style="color: red;">Jenkins Build Failed</h2>

                        <p><b>Status:</b> FAILED</p>
                        <p><b>Job Name:</b> ${env.JOB_NAME}</p>
                        <p><b>Build Number:</b> #${env.BUILD_NUMBER}</p>
                        <p><b>Build URL:</b> ${env.BUILD_URL}${env.BUILD_URL}</a></p>
                        <p>Please check the attached Jenkins console log.</p>
                    </body>
                    </html>
                """
            )
        }

        always {
            echo 'Pipeline execution finished.'
        }
    }
}