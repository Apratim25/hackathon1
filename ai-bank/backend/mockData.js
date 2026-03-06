// Mock banking data
const users = [
  {
    id: "user1",
    pin: "1234",
    name: "John Doe",
    accounts: [
      { id: "acc1", type: "Checking", balance: 5000.0 },
      { id: "acc2", type: "Savings", balance: 12500.0 },
    ],
  },
  {
    id: "user2",
    pin: "4321",
    name: "Jane Smith",
    accounts: [
      { id: "acc3", type: "Checking", balance: 150.0 },
      { id: "acc4", type: "Savings", balance: 2000.0 },
    ],
  },
];

module.exports = { users };
