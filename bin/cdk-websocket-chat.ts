#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkWebsocketChatPipeline } from '../lib/cdk-websocket-chat-pipeline';

const app = new cdk.App();
new CdkWebsocketChatPipeline(app, 'CdkWebsocketChatPipeline');
