import {CdkWebsocketChatStack, StageName} from './cdk-websocket-chat-stack';

import {CfnOutput, Construct, SecretValue, Stack, StackProps, Stage, StageProps} from '@aws-cdk/core';
import {Artifact} from '@aws-cdk/aws-codepipeline';
import {GitHubSourceAction} from '@aws-cdk/aws-codepipeline-actions';
import {CdkPipeline, ShellScriptAction, SimpleSynthAction} from '@aws-cdk/pipelines';
import {PolicyStatement} from '@aws-cdk/aws-iam';

interface WebsocketChatApplicationProps extends StageProps {
    stage: StageName
}

class WebsocketChatApplication extends Stage{
    public readonly websocketEndpoint: CfnOutput
    public readonly stackName: CfnOutput

    constructor(scope: Construct, id: string, props: WebsocketChatApplicationProps){
        super(scope, id, props);

        const stack = new CdkWebsocketChatStack(this, 'webchatapp', {stage: props.stage});
        this.websocketEndpoint = new CfnOutput(stack, 'WEBSOCKET_ENDPOINT', {value: stack.webScoketEndpoint });
        this.stackName = new CfnOutput(stack, 'STACK_NAME', {value: stack.stackName });
    }
}

export class CdkWebsocketChatPipeline extends Stack {
    constructor(scope: Construct, id:string, props?: StackProps){
        super(scope, id, props);

        const sourceArtifact = new Artifact();
        const cloudAssemblyArtifact = new Artifact();

        const pipeline = new CdkPipeline(this, 'webchat-app-pipeline', {
            pipelineName: "webchat-app-pipeline",
            cloudAssemblyArtifact,

            sourceAction: new GitHubSourceAction({
                actionName: 'GitHub',
                output: sourceArtifact,
                oauthToken: SecretValue.secretsManager("github_token", {jsonField: "GITHUB_TOKEN"}),
                owner: 'tetsuya-zama',
                repo: 'cdk-websocket-chat'
            }),

            synthAction: SimpleSynthAction.standardYarnSynth({
                sourceArtifact,
                cloudAssemblyArtifact,
                environment: {
                    privileged: true
                },
                synthCommand: 'yarn cdk synth'
            })
        });

        const testingStage = pipeline.addStage('testing');
        testingStage.addApplication(new WebsocketChatApplication(this, 'staging', {stage: 'staging'}));
        testingStage.nextSequentialRunOrder(-2);
        const e2eApplication = new WebsocketChatApplication(this, 'e2e', {stage: 'e2e'});
        testingStage.addApplication(e2eApplication);
        testingStage.addActions(new ShellScriptAction({
            actionName: 'cypress-testing',
            commands: [
                'npm install -g yarn aws-cli',
                'yarn',
                'npx run cypress run --env endpoint=${WEBSOCKET_ENDPOINT}',
                'aws cloudformation delete-stack --stack-name ${STACK_NAME}'
            ],
            additionalArtifacts: [sourceArtifact],
            useOutputs: {
                WEBSOCKET_ENDPOINT: pipeline.stackOutput(e2eApplication.websocketEndpoint),
                STACK_NAME: pipeline.stackOutput(e2eApplication.stackName)
            },
            rolePolicyStatements: [
                new PolicyStatement({
                    actions: [
                        'cloudformation:DeleteStack',
                        'cloudformation:DescribeStacks'
                    ],
                    resources: ['*']
                })
            ]
        }));

        pipeline.addApplicationStage(
            new WebsocketChatApplication(this, 'prod', {stage: 'prod'}),
            {manualApprovals: true}
        );
    }
}