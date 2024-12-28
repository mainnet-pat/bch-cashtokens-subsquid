import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {type Utxo} from "./utxo.model.js"
import {type TokenHolder} from "./tokenHolder.model.js"

@Entity_()
export class Token {
    constructor(props?: Partial<Token>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    tokenId!: string

    @BigIntColumn_({nullable: false})
    genesisSupply!: bigint

    @BigIntColumn_({nullable: false})
    totalSupply!: bigint

    @IntColumn_({nullable: false})
    nftCount!: number

    @OneToMany_('Utxo', 'token')
    utxos!: Utxo[]

    @OneToMany_('TokenHolder', 'token')
    holders!: TokenHolder[]
}
