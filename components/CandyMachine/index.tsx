// CandyMachine/index.tsx
import { useEffect, useState } from "react";
import {
  fetchCandyMachine,
  mintV2,
  mplCandyMachine,
  safeFetchCandyGuard,
} from '@metaplex-foundation/mpl-candy-machine';
import type {
  CandyGuard as CandyGuardType,
  CandyMachine as CandyMachineType,
  StartDate as StartDateType,
} from '@metaplex-foundation/mpl-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-essentials';
import { getDeprecatedMintNewEditionFromMasterEditionViaPrintingTokenInstructionDataSerializer, getDeprecatedMintPrintingTokensInstructionDataSerializer, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  type Option,
  publicKey,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import type { Umi as UmiType } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { nftStorageUploader } from '@metaplex-foundation/umi-uploader-nft-storage';
import CountdownTimer from "@/components/CountdownTimer";

import candyMachineStyles from './CandyMachine.module.css';
import styles from '@/styles/Home.module.css';

type CandyMachineProps = {
  walletAddress: any;
};

const CandyMachine = (props: CandyMachineProps) => {
  const { walletAddress } = props;
  const [umi, setUmi] = useState<UmiType | undefined>(undefined);
  const [candyMachine, setCandyMachine] = useState<CandyMachineType | undefined>(undefined);
  const [candyGuard, setCandyGuard] = useState<CandyGuardType | undefined>(undefined);
  const [isMinting, setIsMinting] = useState(false);
  const [startDateString, setStartDateString] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [mintSuccess, setMintSuccess] = useState(false);

  const getCandyMachineState = async () => {
    try {
      if (
        process.env.NEXT_PUBLIC_SOLANA_RPC_HOST &&
        process.env.NEXT_PUBLIC_CANDY_MACHINE_ID
      ) {
        const umi = createUmi(process.env.NEXT_PUBLIC_SOLANA_RPC_HOST)
          .use(walletAdapterIdentity(walletAddress))
          .use(nftStorageUploader())
          .use(mplTokenMetadata())
          .use(mplCandyMachine());

        const candyMachine = await fetchCandyMachine(
          umi,
          publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID)
        );
        const candyGuard = await safeFetchCandyGuard(
          umi,
          candyMachine.mintAuthority
        );

        if (!candyMachine || !candyGuard) {
          throw new Error("Failed to fetch candy machine or guard");
        }

        console.log(`items: ${JSON.stringify(candyMachine.items)}`);
        console.log(`itemsAvailable: ${candyMachine.data.itemsAvailable}`);
        console.log(`itemsRedeemed: ${candyMachine.itemsRedeemed}`);

        if (candyGuard.guards.startDate.__option !== "None") {
          const startDate = new Date(
            Number(candyGuard.guards.startDate.value.date) * 1000
          );
          setStartDateString(startDate.toLocaleDateString());
          console.log(`startDate: ${startDate}`);
        }

        setUmi(umi);
        setCandyMachine(candyMachine);
        setCandyGuard(candyGuard);
      }
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Failed to fetch candy machine state");
    }
  };

  const mintToken = async () => {
    if (!candyMachine || !candyGuard || !umi) {
      setError("Initialization not complete");
      return;
    }

    setError("");
    setMintSuccess(false);
    setIsMinting(true);

    try {
      if (candyGuard.guards.solPayment.__option === "None") {
        throw new Error("Destination of solPayment is not set.");
      }

      const nftSigner = generateSigner(umi);
      const destination = candyGuard.guards.solPayment.value.destination;

      const latestBlockhash = await umi.rpc.getLatestBlockhash();
      console.log("Latest blockhash:", latestBlockhash.blockhash);

      const transaction = transactionBuilder()
        .add(setComputeUnitLimit(umi, { units: 600_000 }))
        .add(
          mintV2(umi, {
            candyGuard: candyGuard.publicKey,
            candyMachine: candyMachine.publicKey,
            collectionMint: candyMachine.collectionMint,
            collectionUpdateAuthority: candyMachine.authority,
            mintArgs: {
              solPayment: some({ destination }),
            },
            nftMint: nftSigner,
          })
        )
        .setBlockhash(latestBlockhash.blockhash);

      console.log("Sending transaction...");
      const result = await transaction.sendAndConfirm(umi, {
        confirm: { commitment: "finalized" },
      });

      if (result.result.value.err) {
        throw new Error(`Mint failed: ${result.result.value.err}`);
      }

      console.log("NFT minted successfully!");
      console.log("Transaction signature:", result.signature);
      console.log("NFT address:", nftSigner.publicKey);
      setMintSuccess(true);
      await getCandyMachineState();
    } catch (error) {
      console.error("Mint error:", error);
      setError(error instanceof Error ? error.message : "Mint failed");
    } finally {
      setIsMinting(false);
    }
  };

  const renderContent = () => {
    console.log("Rendering content with:", {
      hasCandyMachine: !!candyMachine,
      hasCandyGuard: !!candyGuard,
      startDateString,
      walletConnected: !!walletAddress
    });

    if (!candyMachine || !candyGuard) {
      return (
        <div className={candyMachineStyles.machineContainer}>
          <p>Loading candy machine data...</p>
        </div>
      );
    }

    const currentDate = new Date();
    const dropDate = candyGuard.guards.startDate.__option !== "None"
      ? new Date(Number(candyGuard.guards.startDate.value.date) * 1000)
      : null;

    console.log("Drop date check:", {
      currentDate,
      dropDate,
      isBeforeDropDate: dropDate && currentDate < dropDate
    });

    return (
      <div className={candyMachineStyles.machineContainer}>
        {dropDate && currentDate < dropDate ? (
          <>
            <p>Drop starts at: {dropDate.toLocaleString()}</p>
            <CountdownTimer dropDate={dropDate} />
          </>
        ) : (
          <>
            <p>Drop Date: {startDateString || "TBA"}</p>
            <p>
              Items Minted: {candyMachine.itemsRedeemed.toString()} / {candyMachine.data.itemsAvailable.toString()}
            </p>
            {error && <p style={{ color: "red" }}>{error}</p>}
            {mintSuccess && <p style={{ color: "green" }}>NFT minted successfully!</p>}
            {candyMachine.itemsRedeemed.toString() === candyMachine.data.itemsAvailable.toString() ? (
              <p>Sold Out</p>
            ) : (
              <button
                className={`${styles.ctaButton} ${styles.mintButton}`}
                onClick={mintToken}
                disabled={isMinting || !walletAddress}
              >
                {!walletAddress 
                  ? "Connect Wallet to Mint"
                  : isMinting 
                    ? "Minting..." 
                    : "Mint NFT"}
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  useEffect(() => {
    console.log("useEffect triggered with wallet:", walletAddress);
    if (walletAddress) {
      getCandyMachineState();
    }
  }, [walletAddress]);

  return renderContent();
};

export default CandyMachine;
