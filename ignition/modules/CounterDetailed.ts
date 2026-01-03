import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CounterDetailedModule", (m) => {
  // 部署 Counter 合约
  const counter = m.contract("Counter");

  // 执行多个操作来测试 gas 消耗
  const call1 = m.call(counter, "inc", [], { id: "call_inc_1" });
  const call2 = m.call(counter, "incBy", [5n], { id: "call_incBy_5", after: [call1] });
  const call3 = m.call(counter, "incBy", [10n], { id: "call_incBy_10", after: [call2] });

  return { counter };
});
