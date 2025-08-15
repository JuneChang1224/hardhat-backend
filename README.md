README.md for how to run this project on local blockchain:

## 1. Open a terminal and navigate to the hardhat-backend folder:

cd hardhat-backend

## 2. Start the local Hardhat blockchain:

npx hardhat node

## This will create 19 sample Ethereum accounts with pre-funded test ETH.

## These accounts can be used for testing login and role-based features later.

## 3. Open a new terminal window (while keeping the blockchain terminal running). Navigate to the hardhat-backend folder again:

cd hardhat-backend

## 4. Deploy the contracts:

npm run deploy

## This will output two important contract addresses:

CompleteSystemModule#SupplyChain - 0x...
CompleteSystemModule#UserManagement - 0x...

## You will need these addresses in the next steps.

## 5. Navigate to the foodtraceUI folder:

cd ../foodtraceUI

## 6. Open (or create) a file named .env in the foodtraceUI folder (frontend), then add the following variables to the .env file:

NEXT_PUBLIC_PROJECT_ID = '0x...'
NEXT_PUBLIC_USERHANDLING_CONTRACT_ADDRESS = "0x..."
NEXT_PUBLIC_SUPPLYCHAIN_CONTRACT_ADDRESS = "0x..."

## NEXT_PUBLIC_PROJECT_ID → Obtain this from Reown website for local development.

## NEXT_PUBLIC_SUPPLYCHAIN_CONTRACT_ADDRESS → Use the address printed for CompleteSystemModule#SupplyChain in Step 2.

## NEXT_PUBLIC_USERHANDLING_CONTRACT_ADDRESS → Use the address printed for CompleteSystemModule#UserManagement in Step 2.

## 7. Inside foodtraceUI/src, create a new folder named abi.

## 8. Inside foodtraceUI/src/abi, create the following two files:

SupplyChain.json
Userhandling.json

## 9. Navigate to the following folder in the backend:

hardhat-backend/ignition/deployments/chain-31337/artifacts

## 10. Copy the contents of CompleteSystemModule#SupplyChain and paste them into SupplyChain.json (under foodtraceUI/src/abi).

## 11. Copy the contents of CompleteSystemModule#UserManagement and paste them into Userhandling.json (under foodtraceUI/src/abi).

## 12. Open a new terminal and navigate to the foodtraceUI folder:

cd foodtraceUI

## 13. Start the frontend server:

npm run dev

## 14. Click on the local link OR Open your browser and go to:

http://localhost:3000
