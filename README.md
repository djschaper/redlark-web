# FBC Redlark

This is an app for planning and organizing worship sets and songs. It is designed as a web app to allow for easy porting to a web-hosted solution, although currently it is released as a local desktop Electron app.

## Developing
To run app locally, use: `npm run start`.

To have code changes automatically restart app, use: `npm run start:dev`.

## Releases
Release procedure:
1. Increment version number in `package.json`
1. Check in all code changes to GitHub
1. Build distributable and create draft release on GitHub with: `npm run release`.
NOTE: Ensure `GH_TOKEN` environment variable is set to a valid GitHub personal access token (PAT).
1. Write a description of the release, using the following template:
    ```
    ## Description
    A brief description of the release and how it affects users.

    ## Features
    * Added feature X

    ## Bug Fixes
    * Fixed bug Y

    ## Supported Platforms
    * Windows x64, x86
    ```
1. Publish the GitHub release. It will be automatically downloaded and installed the next time users open the app.
