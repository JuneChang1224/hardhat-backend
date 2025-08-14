import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

describe("SupplyChain", function () {
  async function deploySupplyChainFixture() {
    const [admin, supplier1, supplier2, seller, addr5] = await hre.viem.getWalletClients();

    const supplyChain = await hre.viem.deployContract("SupplyChain");

    return {
      supplyChain,
      admin,
      supplier1,
      supplier2,
      seller,
      addr5,
    };
  }

  describe("Deployment", function () {
    it("Should initialize counters correctly", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      expect(await supplyChain.read.nextIId()).to.equal(1n);
      expect(await supplyChain.read.nextPId()).to.equal(1n);
    });

    it("Should return correct initial counts", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      const [ingredients, products] = await supplyChain.read.getCounts();
      expect(ingredients).to.equal(0n);
      expect(products).to.equal(0n);
    });
  });

  describe("Ingredient Management", function () {
    it("Should allow anyone to add ingredients", async function () {
      const { supplyChain, supplier1 } = await loadFixture(deploySupplyChainFixture);
      
      await expect(
        supplyChain.write.addIngredient(["Organic Tomatoes", supplier1.account.address, "Vegetables"])
      ).to.be.fulfilled;

      const [name, supplierAddr, category, available, addedAt] = await supplyChain.read.getIngredient([1n]);
      expect(name).to.equal("Organic Tomatoes");
      expect(supplierAddr).to.equal(getAddress(supplier1.account.address));
      expect(category).to.equal("Vegetables");
      expect(available).to.be.true;
      expect(Number(addedAt)).to.be.greaterThan(0);
    });


    it("Should not allow adding ingredient with empty name", async function () {
      const { supplyChain, supplier1 } = await loadFixture(deploySupplyChainFixture);
      
      await expect(
        supplyChain.write.addIngredient(["", supplier1.account.address, "Vegetables"])
      ).to.be.rejectedWith("Name required");
    });

    it("Should not allow adding ingredient with invalid supplier address", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      
      await expect(
        supplyChain.write.addIngredient(["Tomatoes", "0x0000000000000000000000000000000000000000", "Vegetables"])
      ).to.be.rejectedWith("Invalid supplier address");
    });

    it("Should not allow adding ingredient with empty category", async function () {
      const { supplyChain, supplier1 } = await loadFixture(deploySupplyChainFixture);
      
      await expect(
        supplyChain.write.addIngredient(["Tomatoes", supplier1.account.address, ""])
      ).to.be.rejectedWith("Category required");
    });

    it("Should increment ingredient counter", async function () {
      const { supplyChain, supplier1, supplier2 } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.write.addIngredient(["Tomatoes", supplier1.account.address, "Vegetables"]);
      expect(await supplyChain.read.nextIId()).to.equal(2n);

      await supplyChain.write.addIngredient(["Basil", supplier2.account.address, "Herbs"]);
      expect(await supplyChain.read.nextIId()).to.equal(3n);
    });

    it("Should get ingredient details correctly", async function () {
      const { supplyChain, supplier2 } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.write.addIngredient(["Fresh Basil", supplier2.account.address, "Herbs"]);
      
      const [name, supplierAddr, category, available, addedAt] = await supplyChain.read.getIngredient([1n]);
      expect(name).to.equal("Fresh Basil");
      expect(supplierAddr).to.equal(getAddress(supplier2.account.address));
      expect(category).to.equal("Herbs");
      expect(available).to.be.true;
    });

    it("Should fail to get non-existent ingredient", async function () {
      const { supplyChain } = await loadFixture(deploySupplyChainFixture);
      
      await expect(
        supplyChain.read.getIngredient([999n])
      ).to.be.rejectedWith("Invalid ingredient ID");
    });

    it("Should return all available ingredients", async function () {
      const { supplyChain, supplier1, supplier2 } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.write.addIngredient(["Tomatoes", supplier1.account.address, "Vegetables"]);
      await supplyChain.write.addIngredient(["Basil", supplier2.account.address, "Herbs"]);
      await supplyChain.write.addIngredient(["Onions", supplier1.account.address, "Vegetables"]);

      const [ids, names, categories, supplierAddrs] = await supplyChain.read.getAllAvailableIngredients();
      
      expect(ids.length).to.equal(3);
      expect(names).to.deep.equal(["Tomatoes", "Basil", "Onions"]);
      expect(categories).to.deep.equal(["Vegetables", "Herbs", "Vegetables"]);
      expect(supplierAddrs[0]).to.equal(getAddress(supplier1.account.address));
      expect(supplierAddrs[1]).to.equal(getAddress(supplier2.account.address));
      expect(supplierAddrs[2]).to.equal(getAddress(supplier1.account.address));
    });
  });

  describe("Product Management", function () {
    async function deployWithIngredientsFixture() {
      const { supplyChain, admin, supplier1, supplier2, seller, addr5 } = await deploySupplyChainFixture();
      
      // Add some ingredients first
      await supplyChain.write.addIngredient(["Tomatoes", supplier1.account.address, "Vegetables"]);
      await supplyChain.write.addIngredient(["Basil", supplier2.account.address, "Herbs"]);
      await supplyChain.write.addIngredient(["Mozzarella", supplier1.account.address, "Dairy"]);
      
      return { supplyChain, admin, supplier1, supplier2, seller, addr5 };
    }

    it("Should allow creating product with ingredients", async function () {
      const { supplyChain } = await loadFixture(deployWithIngredientsFixture);
      
      const ingredientIds = [1n, 2n, 3n];
      
      await expect(
        supplyChain.write.createProduct(["Margherita Pizza", "BATCH001", ingredientIds])
      ).to.be.fulfilled;

      const [name, batchId, productIngredients, suppliers, approved, total, status, createdAt, finalizedAt] = 
        await supplyChain.read.getProduct([1n]);
      
      expect(name).to.equal("Margherita Pizza");
      expect(batchId).to.equal("BATCH001");
      expect(productIngredients).to.deep.equal([1n, 2n, 3n]);
      expect(suppliers.length).to.equal(2); // supplier1 and supplier2
      expect(approved).to.equal(0);
      expect(total).to.equal(2);
      expect(status).to.equal(0); // Created
      expect(Number(createdAt)).to.be.greaterThan(0);
      expect(finalizedAt).to.equal(0n);
    });

    it("Should not allow creating product without ingredients", async function () {
      const { supplyChain } = await loadFixture(deployWithIngredientsFixture);
      
      await expect(
        supplyChain.write.createProduct(["Empty Product", "BATCH001", []])
      ).to.be.rejectedWith("Need at least one ingredient");
    });

    it("Should not allow creating product with invalid ingredients", async function () {
      const { supplyChain } = await loadFixture(deployWithIngredientsFixture);
      
      await expect(
        supplyChain.write.createProduct(["Invalid Product", "BATCH001", [999n]])
      ).to.be.rejectedWith("Invalid or unavailable ingredient");
    });

    it("Should get product details correctly", async function () {
      const { supplyChain } = await loadFixture(deployWithIngredientsFixture);
      
      await supplyChain.write.createProduct(["Test Product", "BATCH001", [1n, 2n]]);

      const [name, batchId, ingredientIds, suppliers, approved, total, status, createdAt, finalizedAt] = 
        await supplyChain.read.getProduct([1n]);

      expect(name).to.equal("Test Product");
      expect(batchId).to.equal("BATCH001");
      expect(ingredientIds).to.deep.equal([1n, 2n]);
      expect(suppliers.length).to.equal(2); // Two unique suppliers
    });
  });

  describe("Supplier Approval System", function () {
    async function deployWithProductFixture() {
      const { supplyChain, admin, supplier1, supplier2, seller, addr5 } = await deploySupplyChainFixture();
      
      // Add ingredients and create a product
      await supplyChain.write.addIngredient(["Tomatoes", supplier1.account.address, "Vegetables"]);
      await supplyChain.write.addIngredient(["Basil", supplier2.account.address, "Herbs"]);
      await supplyChain.write.createProduct(["Test Product", "BATCH001", [1n, 2n]]);
      
      return { supplyChain, admin, supplier1, supplier2, seller, addr5 };
    }

    it("Should allow supplier to approve their part", async function () {
      const { supplyChain, supplier1 } = await loadFixture(deployWithProductFixture);
      
      const supplyChainAsSupplier1 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier1 } }
      );
      
      await expect(
        supplyChainAsSupplier1.write.approveProduct([1n])
      ).to.be.fulfilled;

      // Check approval status
      expect(await supplyChain.read.approvals([1n, supplier1.account.address])).to.equal(1); // Approved
    });

    it("Should allow supplier to reject their part", async function () {
      const { supplyChain, supplier1 } = await loadFixture(deployWithProductFixture);
      
      const supplyChainAsSupplier1 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier1 } }
      );
      
      await expect(
        supplyChainAsSupplier1.write.rejectProduct([1n])
      ).to.be.fulfilled;

      // Check approval status
      expect(await supplyChain.read.approvals([1n, supplier1.account.address])).to.equal(2); // Rejected
    });

    it("Should not allow non-supplier to approve", async function () {
      const { supplyChain, addr5 } = await loadFixture(deployWithProductFixture);
      
      const supplyChainAsAddr5 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: addr5 } }
      );
      
      await expect(
        supplyChainAsAddr5.write.approveProduct([1n])
      ).to.be.rejectedWith("Not authorized supplier");
    });

    it("Should not allow double approval", async function () {
      const { supplyChain, supplier1 } = await loadFixture(deployWithProductFixture);
      
      const supplyChainAsSupplier1 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier1 } }
      );
      
      await supplyChainAsSupplier1.write.approveProduct([1n]);
      
      await expect(
        supplyChainAsSupplier1.write.approveProduct([1n])
      ).to.be.rejectedWith("Not authorized supplier");
    });

    it("Should finalize product when all suppliers approve", async function () {
      const { supplyChain, supplier1, supplier2 } = await loadFixture(deployWithProductFixture);
      
      const supplyChainAsSupplier1 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier1 } }
      );
      
      const supplyChainAsSupplier2 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier2 } }
      );
      
      await supplyChainAsSupplier1.write.approveProduct([1n]);
      
      await expect(
        supplyChainAsSupplier2.write.approveProduct([1n])
      ).to.be.fulfilled;

      // Check product status
      const [, , , , approved, total, status, , finalizedAt] = await supplyChain.read.getProduct([1n]);
      expect(approved).to.equal(2);
      expect(total).to.equal(2);
      expect(status).to.equal(2); // Approved
      expect(Number(finalizedAt)).to.be.greaterThan(0);
    });

    it("Should reject product when any supplier rejects", async function () {
      const { supplyChain, supplier1, supplier2 } = await loadFixture(deployWithProductFixture);
      
      const supplyChainAsSupplier1 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier1 } }
      );
      
      const supplyChainAsSupplier2 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier2 } }
      );
      
      await supplyChainAsSupplier1.write.approveProduct([1n]);
      
      await expect(
        supplyChainAsSupplier2.write.rejectProduct([1n])
      ).to.be.fulfilled;

      // Check product status
      const [, , , , approved, total, status, , finalizedAt] = await supplyChain.read.getProduct([1n]);
      expect(status).to.equal(3); // Rejected
      expect(Number(finalizedAt)).to.be.greaterThan(0);
    });
  });

  describe("Query Functions", function () {
    async function deployWithDataFixture() {
      const { supplyChain, admin, supplier1, supplier2, seller, addr5 } = await deploySupplyChainFixture();
      
      // Setup test data
      await supplyChain.write.addIngredient(["Tomatoes", supplier1.account.address, "Vegetables"]);
      await supplyChain.write.addIngredient(["Basil", supplier2.account.address, "Herbs"]);
      await supplyChain.write.createProduct(["Product 1", "BATCH001", [1n, 2n]]);
      await supplyChain.write.createProduct(["Product 2", "BATCH002", [1n]]);
      
      return { supplyChain, admin, supplier1, supplier2, seller, addr5 };
    }

    it("Should return correct counts", async function () {
      const { supplyChain } = await loadFixture(deployWithDataFixture);
      
      const [ingredients, products] = await supplyChain.read.getCounts();
      expect(ingredients).to.equal(2n);
      expect(products).to.equal(2n);
    });


    it("Should fail for invalid product IDs", async function () {
      const { supplyChain } = await loadFixture(deployWithDataFixture);
      
      await expect(
        supplyChain.read.getProduct([999n])
      ).to.be.rejectedWith("Invalid product ID");
    });
  });

  describe("Access Control", function () {
    it("Should enforce supplier authorization for approvals", async function () {
      const { supplyChain, supplier1, supplier2 } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.write.addIngredient(["Test Ingredient", supplier1.account.address, "Category"]);
      await supplyChain.write.createProduct(["Test Product", "BATCH001", [1n]]);

      const supplyChainAsSupplier2 = await hre.viem.getContractAt(
        "SupplyChain",
        supplyChain.address,
        { client: { wallet: supplier2 } }
      );
      
      await expect(
        supplyChainAsSupplier2.write.approveProduct([1n])
      ).to.be.rejectedWith("Not authorized supplier");
    });
  });
});