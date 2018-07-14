const AWS = require('aws-sdk')
const archiver = require('archiver-promise')
const fs = require('fs-extra')
const prompt = require('prompt-promise')
const exec = require('child_process').execSync

const { version, beanstalkPackage } = require('../package.json')

const S3_BUCKET = 'schaper'
const APPLICATION_NAME = 'fbc-worship'
const APPLICATION_ENV = 'FbcWorship-env'
const VERSION_REGEX = /^\d+\.\d+\.\d+$/
const BUILD_DIR = 'build'

AWS.config.update({ region: 'ca-central-1' })
const S3 = new AWS.S3()
const EBS = new AWS.ElasticBeanstalk()

const zipFileName = `redlark_${version}.zip`
const zipFilePath = `./${zipFileName}`
const zipFileS3Key = `redlark/web-app/${zipFileName}`

const syncToBuild = (fsObj) => new Promise((resolve, reject) => resolve(fs.copy(fsObj, `${BUILD_DIR}/${fsObj}`)))

const build = () => {
    console.log('Creating build package...')
    return fs.emptyDir(BUILD_DIR)
        .then(() => Promise.all(beanstalkPackage.map(part => syncToBuild(part))))
        .then(() => {
            console.log('Installing production node_modules...')
            exec(`cd ${BUILD_DIR} && npm install --only=production && cd ../`, { stdio: [0, 1, 2] })
        })
        .catch((err) => {
            console.log('There was an error building:')
            console.log(err.message)
            process.exit(0)
        })
}

const sleep = (ms) => new Promise((resolve) => {
    if (resolve < 10) resolve()
    setTimeout(resolve, ms)
})

const monitorStatus = (pause = 0, greenCount = 0) => sleep(pause)
    .then(() => EBS.describeEnvironmentHealth({
        EnvironmentName: APPLICATION_ENV,
        AttributeNames: ['HealthStatus', 'Color', 'Status']
    }).promise())
    .then((status) => {
        console.log(`Application status: ${status.Status} - ${status.HealthStatus} (${status.Color})`)

        if (status.Status === 'Updating') return monitorStatus(3000)

        if (status.Color === 'Red') {
            console.log('Something is wrong. Check application.')
        } else if (status.Color === 'Green') {
            if (++greenCount < 3) return monitorStatus(3000, greenCount)

            console.log('Application is running smoothly!')
        }

        return Promise.resolve()
    })

const deploy = () => {
    const versionLabel = `Redlark ${version}`
    console.log(`Ready to create new application verson "${versionLabel}"`)
    return prompt('Proceed? (y/n): ')
        .then((proceed) => {
            if (proceed.toLowerCase() !== 'y') {
                console.log('Not creating application. Exiting.')
                process.exit(0)
            }
            return Promise.resolve()
        })
        .then(() => {
            console.log('Zipping deployment package...')
            const archive = archiver(zipFilePath, { store: true })
            archive.directory(BUILD_DIR, false)
            return archive.finalize()
        })
        .then(() => {
            console.log(`All zipped up in: ${zipFileName}`)
            console.log('Uploading zip to S3...')
            return S3.upload({
                Bucket: S3_BUCKET,
                Key: zipFileS3Key,
                Body: fs.createReadStream(zipFilePath)
            }).promise()
        })
        .then(() => {
            console.log('Zip uploaded to S3, cleaning up local copy')
            return fs.remove(zipFilePath)
        })
        .then(() => {
            console.log('Creating new Elastic Beanstalk application version...')
            return EBS.createApplicationVersion({
                ApplicationName: APPLICATION_NAME,
                VersionLabel: versionLabel,
                AutoCreateApplication: false,
                SourceBundle: {
                    S3Bucket: S3_BUCKET,
                    S3Key: zipFileS3Key
                },
                Process: true
            }).promise()
        })
        .then(() => EBS.updateEnvironment({
            EnvironmentName: APPLICATION_ENV,
            VersionLabel: versionLabel
        }).promise())
        .then(() => {
            console.log('Deployment complete!')
            return monitorStatus()
        })
        .then(() => {
            process.exit(0)
        })
        .catch((err) => {
            console.log('There was an error deploying:')
            console.log(err.message)
            process.exit(0)
        })
}

const buildAndDeploy = () => build().then(() => deploy())

module.exports = {
    build,
    deploy,
    monitorStatus,
    buildAndDeploy
}