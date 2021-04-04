import {CdkWebsocketChatStack} from './cdk-websocket-chat-stack';

import {Construct, SecretValue, Stack, StackProps, Stage, StageProps} from '@aws-cdk/core';
import {Artifact} from '@aws-cdk/aws-codepipeline';
import {GitHubSourceAction} from '@aws-cdk/aws-codepipeline-actions';
import {CdkPipeline, SimpleSynthAction} from '@aws-cdk/pipelines';

class WebsocketChatApplication extends Stage{
    constructor(scope: Construct, id: string, props?: StageProps){
        super(scope, id, props);

        new CdkWebsocketChatStack(this, 'webchatapp', {stage: id});
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

        pipeline.addApplicationStage(
            new WebsocketChatApplication(this, 'staging')
        );

        pipeline.addApplicationStage(
            new WebsocketChatApplication(this, 'prod'),
            {manualApprovals: true}
        );
    }
}