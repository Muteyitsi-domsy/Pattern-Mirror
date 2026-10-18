import * as functions from 'firebase-functions';
import { createApp } from './app';

/** Single Cloud Function serving the whole Express API. */
export const api = functions.https.onRequest(createApp());
