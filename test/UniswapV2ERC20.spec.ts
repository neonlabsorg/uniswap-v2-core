import chai, { expect } from 'chai'
import {Contract, providers, Wallet} from 'ethers'
import { MaxUint256 } from 'ethers/constants'
import { bigNumberify, hexlify, keccak256, defaultAbiCoder, toUtf8Bytes } from 'ethers/utils'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'
// import { Wallet, Contract } from 'ethers';
import * as ethers from 'ethers';
import {Interface} from 'ethers/utils/interface'
import {input} from './erc20_abi'

import { expandTo9Decimals, getApprovalDigest } from './shared/utilities'

import ERC20 from '../build/ERC20.json'

chai.use(solidity)

const TOTAL_SUPPLY = expandTo9Decimals(4)
const TEST_AMOUNT = expandTo9Decimals(1)
const TEST_BALANCE = expandTo9Decimals(8)

describe('UniswapV2ERC20', () => {
  // const provider1 = new MockProvider({
  //   hardfork: 'istanbul',
  //   mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
  //   gasLimit: 9999999
  // })
  // const [wallet1, other] = provider1.getWallets()

  const provider_sol = new ethers.providers.JsonRpcProvider("http://127.0.0.1:9090/solana");
  const wallet = new Wallet("0xd191daa598a77767eae21d33c865422f95a01f705bc4fbef8271d46177b075be", provider_sol)
  const other = Wallet.createRandom().connect(provider_sol)

  let token: Contract
  beforeEach(async () => {
    token = new Contract("0x07a95c05ca6b26b525514e50adb34e7410df9e0f", JSON.parse(input), wallet)
    // token = await deployContract(wallet, ERC20, [TOTAL_SUPPLY])
  })
  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    const name = await token.name()
    expect(name).to.eq('n1')
    expect(await token.symbol()).to.eq('s1')
    expect(await token.decimals()).to.eq(9)
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY)
    expect(await token.balanceOf(wallet.address)).to.eq(TEST_BALANCE)
    // expect(await token.DOMAIN_SEPARATOR()).to.eq(
    //   keccak256(
    //     defaultAbiCoder.encode(
    //       ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
    //       [
    //         keccak256(
    //           toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
    //         ),
    //         keccak256(toUtf8Bytes(name)),
    //         keccak256(toUtf8Bytes('1')),
    //         1,
    //         token.address
    //       ]
    //     )
    //   )
    // )
    // expect(await token.PERMIT_TYPEHASH()).to.eq(
    //   keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'))
    // )
  })

  it('approve', async () => {
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
  })

  it('transfer', async () => {
    expect(await token.transfer(other.address, TEST_AMOUNT))
    expect(await token.balanceOf(wallet.address)).to.eq(TEST_BALANCE.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  // it('transfer:fail', async () => {
  //   await expect(token.transfer(other.address, TOTAL_SUPPLY.add(1))).to.be.reverted // ds-math-sub-underflow
    // await expect(token.connect(other).transfer(wallet.address, 1)).to.be.reverted // ds-math-sub-underflow
  // })
  //
  it('transferFrom', async () => {
    await token.approve(other.address, TEST_AMOUNT)
    expect(await token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT));
    expect(await token.allowance(wallet.address, other.address)).to.eq(0)
    expect(await token.balanceOf(wallet.address)).to.eq(TEST_BALANCE.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('transferFrom:max', async () => {
    await token.approve(other.address, MaxUint256)
    expect(await token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
    expect(await token.allowance(wallet.address, other.address)).to.eq(MaxUint256.sub(10**9))
    expect(await token.balanceOf(wallet.address)).to.eq(TEST_BALANCE.sub(TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('permit', async () => {
    const nonce = await token.nonces(wallet.address)
    const deadline = MaxUint256
    const digest = await getApprovalDigest(
      token,
      { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
      nonce,
      deadline
    )

    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

    await expect(token.permit(wallet.address, other.address, TEST_AMOUNT, deadline, v, hexlify(r), hexlify(s)))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT)
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
    expect(await token.nonces(wallet.address)).to.eq(bigNumberify(1))
  })
})
