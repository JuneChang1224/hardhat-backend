//ignition/modules/Deployment.ts

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const DeploymentModule = buildModule('DeploymentModule', (m) => {
  const FnBToken = m.contract('FnBToken');
  const ICO = m.contract('ICO', [FnBToken]);

  const owner = m.getAccount(0);
  const totalSupply = m.staticCall(FnBToken, 'totalSupply');
  m.call(FnBToken, 'approve', [ICO, totalSupply], {
    from: owner,
  });

  return { FnBToken, ICO };
});

export default DeploymentModule;
