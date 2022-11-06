const {expect,assert}=require("chai")
const { ethers, getNamedAccounts, network } = require("hardhat")

const { networkConfig } = require("../helper-hardhat-config")
const wethTokenAddress =networkConfig[network.config.chainId].wethToken

const AMOUNT = ethers.utils.parseEther("0.02")

describe("AAVE Testing",()=>{
    let iweth
    let lendingPool
    let account
    let amountDaiToBorrow 
    let amountDaiToBorrowWei
    let price
    beforeEach(async function(){
        const { deployer } = await getNamedAccounts()
        account=deployer
        iweth =await ethers.getContractAt(
            "IWeth",    
            networkConfig[network.config.chainId].wethToken,
            account
        )
        let txResponse = await iweth.deposit({
            value: AMOUNT,
        })
        await txResponse.wait(1)

        const lendingPoolAddressesProvider = await ethers.getContractAt(
            "ILendingPoolAddressesProvider",
            networkConfig[network.config.chainId].lendingPoolAddressesProvider,
            account
        )
        const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
        lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)

        txResponse = await iweth.approve(lendingPool.address, AMOUNT)
        await txResponse.wait(1)


        const {totalCollateralETH,totalDebtETH,availableBorrowsETH}=await lendingPool.getUserAccountData(account)
        const daiEthPriceFeed = await ethers.getContractAt(
            "AggregatorV3Interface",
            networkConfig[network.config.chainId].daiEthPriceFeed
        )
        price = (await daiEthPriceFeed.latestRoundData())[1]
    })

    it("iweth transfer check",async function(){
        const wethBalance = await iweth.balanceOf(account)
        assert.equal(wethBalance.toString(), AMOUNT)
    })
    it("depositing iweth in lending pool",async function(){
        await lendingPool.deposit(wethTokenAddress, AMOUNT, account, 0)
        const {totalCollateralETH,totalDebtETH,availableBorrowsETH}=await lendingPool.getUserAccountData(account)
        amountDaiToBorrow = availableBorrowsETH.toString() * 0.9 * (1 / price.toNumber())
        amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
        assert.equal(totalCollateralETH.toString(),AMOUNT)
    })
    it("borrow dai from lending pool",async function(){

        const borrowTx = await lendingPool.borrow(networkConfig[network.config.chainId].daiToken, amountDaiToBorrow, 1, 0, account)
        await borrowTx.wait(1)

        const {totalCollateralETH,totalDebtETH,availableBorrowsETH}=await lendingPool.getUserAccountData(account)

        let debt1=ethers.utils.parseEther(totalDebtETH.toString())
        let debt2=amountDaiToBorrowWei.toString()
        assert.equal(debt1,debt2)
    })
    it("repay the lending pool",async function(){
        txResponse = await iweth.approve(lendingPool.address, AMOUNT)
        await txResponse.wait(1)


        const repayTx = await lendingPool.repay(networkConfig[network.config.chainId].daiToken, AMOUNT, 1, account)
        await repayTx.wait(1)
        const {totalCollateralETH,totalDebtETH,availableBorrowsETH}=await lendingPool.getUserAccountData(account)
        assert.equal(totalDebtETH.toString(),"0")
    })
})
