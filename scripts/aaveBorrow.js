const { ethers, getNamedAccounts, network } = require("hardhat")

const { networkConfig } = require("../helper-hardhat-config")

const AMOUNT = ethers.utils.parseEther("0.02")
async function main(){
    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLendingPool(deployer)
    await getWeth(deployer)
    console.log(`Lending Pool Address ${lendingPool.address}`)

    const wethTokenAddress =networkConfig[network.config.chainId].wethToken
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing WETH...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Desposited!")

    let {availableBorrowsETH, totalDebtETH}=await getUserData(lendingPool,deployer)

    const daiPrice = await getDaiPrice()

    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.9 * (1 / daiPrice.toNumber())
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    console.log(`You can borrow ${amountDaiToBorrow.toString()} DAI`)
    await borrowDai(
        networkConfig[network.config.chainId].daiToken,
        lendingPool,
        amountDaiToBorrowWei,
        deployer
    )

    await repay(
        amountDaiToBorrowWei,
        networkConfig[network.config.chainId].daiToken,
        lendingPool,
        deployer
    )
    await getUserData(lendingPool, deployer)

}
async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[network.config.chainId].lendingPoolAddressesProvider,
        account
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}


async function approveErc20(erc20Address, spenderAddress, amount, signer) {
    const erc20Token = await ethers.getContractAt("IWeth", erc20Address, signer)
    txResponse = await erc20Token.approve(spenderAddress, amount)
    await txResponse.wait(1)
    console.log("Approved!")
}
async function getUserData(lendingPool, user){
    const {totalCollateralETH,totalDebtETH,availableBorrowsETH}=await lendingPool.getUserAccountData(user)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited.`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed.`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH.`)
    return { availableBorrowsETH, totalDebtETH }
}
async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config.chainId].daiEthPriceFeed
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`The ETH/DAI price is ${price.toString()}`)
    return price
}
async function borrowDai(daiAddress, lendingPool, amountDaiToBorrow, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrow, 1, 0, account)
    await borrowTx.wait(1)
    console.log("You've borrowed!")
}
async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("Repaid!")
}
async function getWeth(deployer){
   
    const IWeth =await ethers.getContractAt(
        "IWeth",    
        networkConfig[network.config.chainId].wethToken,
        deployer
    )
    const txResponse = await IWeth.deposit({
        value: AMOUNT,
    })
    await txResponse.wait(1)
    const wethBalance = await IWeth.balanceOf(deployer)
    console.log(`Got ${wethBalance.toString()} WETH`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
