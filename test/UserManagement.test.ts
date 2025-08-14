import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

describe("UserManagement", function () {
  // Fixture to deploy the contract
  async function deployUserManagementFixture() {
    // Get wallet clients
    const [owner, manager, seller, supplier, addr4] = await hre.viem.getWalletClients();

    // Deploy the contract
    const userManagement = await hre.viem.deployContract("UserManagement");

    return {
      userManagement,
      owner,
      manager,
      seller,
      supplier,
      addr4,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { userManagement, owner } = await loadFixture(deployUserManagementFixture);
      expect(await userManagement.read.owner()).to.equal(getAddress(owner.account.address));
    });

    it("Should auto-register owner as Manager", async function () {
      const { userManagement, owner } = await loadFixture(deployUserManagementFixture);
      const [role, displayName] = await userManagement.read.getUserRole([owner.account.address]);
      expect(role).to.equal(1); // Manager role
      expect(displayName).to.equal("System Owner");
    });

    it("Should have owner registered", async function () {
      const { userManagement, owner } = await loadFixture(deployUserManagementFixture);
      expect(await userManagement.read.isRegistered([owner.account.address])).to.be.true;
    });

    it("Should have total users count of 1", async function () {
      const { userManagement } = await loadFixture(deployUserManagementFixture);
      expect(await userManagement.read.getTotalUsers()).to.equal(1n);
    });
  });

  describe("User Creation", function () {
    it("Should allow owner to create a manager", async function () {
      const { userManagement, manager } = await loadFixture(deployUserManagementFixture);
      
      await expect(
        userManagement.write.createUser([manager.account.address, 1, "Test Manager"])
      ).to.be.fulfilled;

      const [role, displayName] = await userManagement.read.getUserRole([manager.account.address]);
      expect(role).to.equal(1);
      expect(displayName).to.equal("Test Manager");
    });

    it("Should allow owner to create a seller", async function () {
      const { userManagement, seller } = await loadFixture(deployUserManagementFixture);
      
      await userManagement.write.createUser([seller.account.address, 2, "Test Seller"]);

      const [role, displayName] = await userManagement.read.getUserRole([seller.account.address]);
      expect(role).to.equal(2);
      expect(displayName).to.equal("Test Seller");
    });

    it("Should allow owner to create a supplier", async function () {
      const { userManagement, supplier } = await loadFixture(deployUserManagementFixture);
      
      await userManagement.write.createUser([supplier.account.address, 3, "Test Supplier"]);

      const [role, displayName] = await userManagement.read.getUserRole([supplier.account.address]);
      expect(role).to.equal(3);
      expect(displayName).to.equal("Test Supplier");
    });

    it("Should allow manager to create sellers and suppliers", async function () {
      const { userManagement, manager, seller, supplier } = await loadFixture(deployUserManagementFixture);
      
      // First create a manager
      await userManagement.write.createUser([manager.account.address, 1, "Test Manager"]);

      // Get contract instance for manager
      const userManagementAsManager = await hre.viem.getContractAt(
        "UserManagement",
        userManagement.address,
        { client: { wallet: manager } }
      );

      // Manager creates a seller
      await userManagementAsManager.write.createUser([seller.account.address, 2, "Seller by Manager"]);
      
      const [role, displayName] = await userManagement.read.getUserRole([seller.account.address]);
      expect(role).to.equal(2);
      expect(displayName).to.equal("Seller by Manager");

      // Manager creates a supplier
      await userManagementAsManager.write.createUser([supplier.account.address, 3, "Supplier by Manager"]);
      
      const [supplierRole, supplierName] = await userManagement.read.getUserRole([supplier.account.address]);
      expect(supplierRole).to.equal(3);
      expect(supplierName).to.equal("Supplier by Manager");
    });

    it("Should not allow manager to create other managers", async function () {
      const { userManagement, manager, addr4 } = await loadFixture(deployUserManagementFixture);
      
      // First create a manager
      await userManagement.write.createUser([manager.account.address, 1, "Test Manager"]);

      // Get contract instance for manager
      const userManagementAsManager = await hre.viem.getContractAt(
        "UserManagement",
        userManagement.address,
        { client: { wallet: manager } }
      );

      // Manager tries to create another manager (should fail)
      await expect(
        userManagementAsManager.write.createUser([addr4.account.address, 1, "Another Manager"])
      ).to.be.rejectedWith("Managers can only create Sellers and Suppliers");
    });

    it("Should not allow non-owner/manager to create users", async function () {
      const { userManagement, seller, addr4 } = await loadFixture(deployUserManagementFixture);
      
      const userManagementAsSeller = await hre.viem.getContractAt(
        "UserManagement",
        userManagement.address,
        { client: { wallet: seller } }
      );
      
      await expect(
        userManagementAsSeller.write.createUser([addr4.account.address, 2, "Test User"])
      ).to.be.rejectedWith("Only owner or manager can perform this action");
    });

    it("Should not allow creating user with invalid address", async function () {
      const { userManagement } = await loadFixture(deployUserManagementFixture);
      
      await expect(
        userManagement.write.createUser(["0x0000000000000000000000000000000000000000", 2, "Test User"])
      ).to.be.rejectedWith("Invalid user address");
    });

    it("Should not allow creating user that already exists", async function () {
      const { userManagement, seller } = await loadFixture(deployUserManagementFixture);
      
      await userManagement.write.createUser([seller.account.address, 2, "Test Seller"]);
      
      await expect(
        userManagement.write.createUser([seller.account.address, 3, "Test Supplier"])
      ).to.be.rejectedWith("User already registered");
    });

    it("Should not allow creating user with unregistered role", async function () {
      const { userManagement, seller } = await loadFixture(deployUserManagementFixture);
      
      await expect(
        userManagement.write.createUser([seller.account.address, 0, "Test User"])
      ).to.be.rejectedWith("Cannot assign Unregistered role");
    });

    it("Should not allow creating user with empty display name", async function () {
      const { userManagement, seller } = await loadFixture(deployUserManagementFixture);
      
      await expect(
        userManagement.write.createUser([seller.account.address, 2, ""])
      ).to.be.rejectedWith("Display name required");
    });
  });

  describe("User Queries", function () {
    async function deployWithUsersFixture() {
      const { userManagement, owner, manager, seller, supplier, addr4 } = await deployUserManagementFixture();
      
      await userManagement.write.createUser([manager.account.address, 1, "Test Manager"]);
      await userManagement.write.createUser([seller.account.address, 2, "Test Seller"]);
      await userManagement.write.createUser([supplier.account.address, 3, "Test Supplier"]);
      
      return { userManagement, owner, manager, seller, supplier, addr4 };
    }

    it("Should return correct user role for registered users", async function () {
      const { userManagement, seller } = await loadFixture(deployWithUsersFixture);
      
      const [role, displayName, registeredAt] = await userManagement.read.getUserRole([seller.account.address]);
      expect(role).to.equal(2);
      expect(displayName).to.equal("Test Seller");
      expect(Number(registeredAt)).to.be.greaterThan(0);
    });

    it("Should return unregistered for non-registered users", async function () {
      const { userManagement, addr4 } = await loadFixture(deployWithUsersFixture);
      
      const [role, displayName, registeredAt] = await userManagement.read.getUserRole([addr4.account.address]);
      expect(role).to.equal(0);
      expect(displayName).to.equal("");
      expect(registeredAt).to.equal(0n);
    });

    it("Should return correct user details", async function () {
      const { userManagement, owner, seller } = await loadFixture(deployWithUsersFixture);
      
      const user = await userManagement.read.getUserDetails([seller.account.address]);
      expect(user.walletAddress).to.equal(getAddress(seller.account.address));
      expect(user.role).to.equal(2);
      expect(user.displayName).to.equal("Test Seller");
      expect(user.registeredBy).to.equal(getAddress(owner.account.address));
    });

    it("Should verify user roles correctly", async function () {
      const { userManagement, manager, seller, supplier } = await loadFixture(deployWithUsersFixture);
      
      expect(await userManagement.read.result([manager.account.address, 1])).to.be.true;
      expect(await userManagement.read.result([seller.account.address, 2])).to.be.true;
      expect(await userManagement.read.result([supplier.account.address, 3])).to.be.true;
      expect(await userManagement.read.result([seller.account.address, 1])).to.be.false;
    });

    it("Should return users by role", async function () {
      const { userManagement, owner, manager, seller } = await loadFixture(deployWithUsersFixture);
      
      const [managerAddresses, managerNames] = await userManagement.read.getUsersByRole([1]);
      expect(managerAddresses.length).to.equal(2); // owner + created manager
      expect(managerNames.length).to.equal(2);
      expect(managerAddresses).to.include(getAddress(owner.account.address));
      expect(managerAddresses).to.include(getAddress(manager.account.address));

      const [sellerAddresses, sellerNames] = await userManagement.read.getUsersByRole([2]);
      expect(sellerAddresses.length).to.equal(1);
      expect(sellerAddresses[0]).to.equal(getAddress(seller.account.address));
      expect(sellerNames[0]).to.equal("Test Seller");
    });

    it("Should return correct user statistics", async function () {
      const { userManagement } = await loadFixture(deployWithUsersFixture);
      
      const [managers, sellers, suppliers] = await userManagement.read.getUserStats();
      expect(managers).to.equal(2n); // owner + created manager
      expect(sellers).to.equal(1n);
      expect(suppliers).to.equal(1n);
    });

    it("Should return all registered users", async function () {
      const { userManagement, owner, manager, seller, supplier } = await loadFixture(deployWithUsersFixture);
      
      const allUsers = await userManagement.read.getAllUsers();
      expect(allUsers.length).to.equal(4); // owner + 3 created users
      expect(allUsers).to.include(getAddress(owner.account.address));
      expect(allUsers).to.include(getAddress(manager.account.address));
      expect(allUsers).to.include(getAddress(seller.account.address));
      expect(allUsers).to.include(getAddress(supplier.account.address));
    });

    it("Should return correct total users count", async function () {
      const { userManagement } = await loadFixture(deployWithUsersFixture);
      
      expect(await userManagement.read.getTotalUsers()).to.equal(4n);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to perform owner actions", async function () {
      const { userManagement, seller, addr4 } = await loadFixture(deployUserManagementFixture);
      
      const userManagementAsSeller = await hre.viem.getContractAt(
        "UserManagement",
        userManagement.address,
        { client: { wallet: seller } }
      );
      
      await expect(
        userManagementAsSeller.write.createUser([addr4.account.address, 2, "Test"])
      ).to.be.rejectedWith("Only owner or manager can perform this action");
    });

    it("Should fail getting details for non-registered user", async function () {
      const { userManagement, addr4 } = await loadFixture(deployUserManagementFixture);
      
      await expect(
        userManagement.read.getUserDetails([addr4.account.address])
      ).to.be.rejectedWith("User not registered");
    });
  });
});