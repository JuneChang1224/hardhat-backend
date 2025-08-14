
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CompleteSystemModule = buildModule("CompleteSystemModule", (m) => {
  // Deploy UserHandling contract first
  const userManagement = m.contract("UserManagement", []);

  // Deploy SupplyChain contract
  const supplyChain = m.contract("SupplyChain", []);

  return { 
    userManagement, 
    supplyChain 
  };
});

export default CompleteSystemModule;