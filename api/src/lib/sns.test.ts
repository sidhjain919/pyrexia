/**
 * Bounce notifications are only worth acting on if we can tell a real one from
 * a forged one: a fake bounce would let a stranger stop us emailing whichever
 * address they chose.
 *
 * The certificate and signature below are real, generated with openssl at the
 * time this test was written and signed over the exact canonical string Amazon
 * would sign. So this exercises the whole path: pulling the public key out of
 * an X.509 certificate, rebuilding the canonical string, and checking an RSA
 * signature over it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { publicKeyFromCert, verifySnsMessage, type SnsMessage } from './sns.ts'

export const CERT = `-----BEGIN CERTIFICATE-----
MIIDGTCCAgGgAwIBAgIUOpHFb5uqGO4o2N05VV3wJXa05HQwDQYJKoZIhvcNAQEL
BQAwHDEaMBgGA1UEAwwRc25zLmFtYXpvbmF3cy5jb20wHhcNMjYwODI4MTc1MTUz
WhcNMjYwODMwMTc1MTUzWjAcMRowGAYDVQQDDBFzbnMuYW1hem9uYXdzLmNvbTCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALnSAqGtjK6vf/beXCM38Vcj
/Ga0hKP6OLddLq3XmvUiKDk8jxmBqeibvO8ihTkEiuXMKFKgwGVNicPVSDEpjbmm
GLmp9gkF3Ur2BDkFBlk6xr9eSDugdaeNWBDT7slPRaU8jJa+eyxZNwIb/bRZpgbx
GuTSh+sWkj6gluDcXLxKKcNk/g4DLkY9Cp73b/8GcBZK3MZWXIfm6narUhsB3GYt
QS+JjsIJJu4JWdtvg6G8HjklvkSG+VJptBR8vs7sZnFVxWLSu9mR9NagBAC1PC8y
eKwctsbw+0XYeS8o9xJce59iOClKM2V8XdferYXSTpyl0L6WfrmfSUoWFoCKKi0C
AwEAAaNTMFEwHQYDVR0OBBYEFL9fJVOAzLKY/bl962iTpw87bJAUMB8GA1UdIwQY
MBaAFL9fJVOAzLKY/bl962iTpw87bJAUMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI
hvcNAQELBQADggEBAKRgyw6upvoQYujroHMg6uTBSrjD+89lvIduDetwV+itQsLJ
R6ChFbAsJQ2HltVMTqZeREXKItYRMRy9M7H8sFCMGfSulCaQuR9EI/eawIC935VZ
3nT6pUW/qBAw6s4bpwe85peltPFxT1AkG11TNp/hZmKecqlzBAhALlg4xlPzCVuB
j6/H7W2LyDEFBAGCQD7jzPWNmH7fk2YRsxtxrme2+GCJdUcowmWEAfkbmceG6dL5
9/MVTUSP85ZQPmctFGoScOB48WZLXFHHPEelxmH02v1SZ+ozx/5afXQWXTjMywTd
MSaCCfYaURMbEfUdozCcPuRhmarshAkbpgUhiJ0=
-----END CERTIFICATE-----`

export const SIGNATURE =
  "BhCd8lBfaP5gwUuL55H9nUmNaWhleO46d5/RlH7W3LEIVuGNkCs4bIkmhzEX6R9XvteFfY4m4zN2qy5CrHkJqqZtKjFnk/vVEIJIcJRxY62BRRjhVAZ8r5aqi8WH8WwrXUEsLHYoPbSdGenwxTHFUJEXCrOtRRSpvLAx3l5Rd5udlMSbrS+QnG0ISsw4kbzSLV+DJzDaN/CYYTVFQaoWwCjaOZb1KHspa78VH9/9VDwIA8fCxLOH3uD3FnzA03PRvjxxw1SnLezO9f2+PZlQfs0RjCG2HefCNbCGHRLnm+dQ++1guR0PHN+PEsuUKNiVgJkw1xXQ6HtaRArJoMgdOg=="

const message: SnsMessage = {
  Type: 'Notification',
  MessageId: 'mid-1',
  TopicArn: 'arn:aws:sns:ap-south-1:1:pyrexia',
  Message: 'hello bounce',
  Timestamp: '2026-08-27T18:00:00.000Z',
  SignatureVersion: '2',
  Signature: SIGNATURE,
  SigningCertURL: 'https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-abc.pem',
}

/** Stands in for Amazon serving its certificate. */
const serveCert = (async () => new Response(CERT, { status: 200 })) as unknown as typeof fetch

test('sns: lifts an importable RSA key out of an X.509 certificate', async () => {
  const key = await publicKeyFromCert(CERT, 'SHA-256')
  assert.equal(key.type, 'public')
  assert.equal(key.algorithm.name, 'RSASSA-PKCS1-v1_5')
  assert.equal((key.algorithm as { modulusLength: number }).modulusLength, 2048)
})

test('sns: accepts a genuine signature', async () => {
  assert.equal(await verifySnsMessage(message, serveCert), true)
})

test('sns: rejects a tampered message', async () => {
  // The attack this stops: same signature, different victim.
  const forged = { ...message, Message: 'suppress someone-else@example.com' }
  assert.equal(await verifySnsMessage(forged, serveCert), false)
})

test('sns: rejects a certificate served from somewhere other than Amazon', async () => {
  // Without this the check would be circular: the sender chooses the URL, so
  // they would simply point it at their own certificate.
  const spoofed = {
    ...message,
    SigningCertURL: 'https://attacker.example.com/SimpleNotificationService-abc.pem',
  }
  assert.equal(await verifySnsMessage(spoofed, serveCert), false)
})

test('sns: rejects a lookalike hostname', async () => {
  const spoofed = {
    ...message,
    SigningCertURL: 'https://sns.amazonaws.com.attacker.example/cert.pem',
  }
  assert.equal(await verifySnsMessage(spoofed, serveCert), false)
})

test('sns: rejects an unknown signature version', async () => {
  const odd = { ...message, SignatureVersion: '9' }
  assert.equal(await verifySnsMessage(odd, serveCert), false)
})

test('sns: a signature for a Notification does not validate as a subscription', async () => {
  // The two message types have different canonical field orders, so a
  // signature must not carry across.
  const swapped = { ...message, Type: 'SubscriptionConfirmation', Token: 't', SubscribeURL: 'https://x' }
  assert.equal(await verifySnsMessage(swapped, serveCert), false)
})
