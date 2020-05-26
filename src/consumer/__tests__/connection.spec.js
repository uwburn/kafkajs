const createProducer = require('../../producer')
const createConsumer = require('../index')

const {
  secureRandom,
  createCluster,
  createTopic,
  createModPartitioner,
  newLogger,
  sslConnectionOpts,
  saslSCRAM256ConnectionOpts,
  saslSCRAM512ConnectionOpts,
  saslOAuthBearerConnectionOpts,
  sslBrokers,
  saslBrokers,
  waitFor,
  waitForConsumerToJoinGroup,
} = require('testHelpers')

describe('Consumer', () => {
  let topicName, groupId, cluster, producer, consumer

  beforeEach(async () => {
    topicName = `test-topic-${secureRandom()}`
    groupId = `consumer-group-id-${secureRandom()}`

    await createTopic({ topic: topicName })

    cluster = createCluster()
  })

  afterEach(async () => {
    await consumer.disconnect()
  })

  test('support SSL connections', async () => {
    cluster = createCluster(sslConnectionOpts(), sslBrokers())
    consumer = createConsumer({
      cluster,
      groupId,
      maxWaitTimeInMs: 1,
      logger: newLogger(),
    })

    await consumer.connect()
  })

  test('support SASL PLAIN connections', async () => {
    cluster = createCluster(
      Object.assign(sslConnectionOpts(), {
        sasl: {
          mechanism: 'plain',
          username: 'test',
          password: 'testtest',
        },
      }),
      saslBrokers()
    )

    consumer = createConsumer({
      cluster,
      groupId,
      maxWaitTimeInMs: 1,
      logger: newLogger(),
    })

    await consumer.connect()
  })

  test('support SASL SCRAM 256 connections', async () => {
    cluster = createCluster(saslSCRAM256ConnectionOpts(), saslBrokers())

    consumer = createConsumer({
      cluster,
      groupId,
      maxWaitTimeInMs: 1,
      logger: newLogger(),
    })

    await consumer.connect()
  })

  test('support SASL SCRAM 512 connections', async () => {
    cluster = createCluster(saslSCRAM512ConnectionOpts(), saslBrokers())

    consumer = createConsumer({
      cluster,
      groupId,
      maxWaitTimeInMs: 1,
      logger: newLogger(),
    })

    await consumer.connect()
  })

  test('support SASL OAUTHBEARER connections', async () => {
    cluster = createCluster(saslOAuthBearerConnectionOpts(), saslBrokers())

    consumer = createConsumer({
      cluster,
      groupId,
      maxWaitTimeInMs: 1,
      logger: newLogger(),
    })

    await consumer.connect()
  })

  test('reconnects the cluster if disconnected', async () => {
    consumer = createConsumer({
      cluster,
      groupId,
      maxWaitTimeInMs: 1,
      maxBytesPerPartition: 180,
      logger: newLogger(),
      retry: { retries: 3 },
    })

    producer = createProducer({
      cluster: createCluster(),
      createPartitioner: createModPartitioner,
      logger: newLogger(),
    })

    await consumer.connect()
    await producer.connect()
    await consumer.subscribe({ topic: topicName, fromBeginning: true })

    const messages = []
    consumer.run({
      eachMessage: async ({ message }) => {
        messages.push(message)
      },
    })

    await waitForConsumerToJoinGroup(consumer)

    expect(cluster.isConnected()).toEqual(true)
    await cluster.disconnect()
    expect(cluster.isConnected()).toEqual(false)

    try {
      await producer.send({
        acks: 1,
        topic: topicName,
        messages: [{ key: `key-${secureRandom()}`, value: `value-${secureRandom()}` }],
      })
    } finally {
      await producer.disconnect()
    }

    await waitFor(() => cluster.isConnected())
    await expect(waitFor(() => messages.length > 0)).resolves.toBeTruthy()
  })
})
