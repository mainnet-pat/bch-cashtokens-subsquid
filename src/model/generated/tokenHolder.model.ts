import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, ManyToOne as ManyToOne_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {type Token} from "./token.model.js"
import {type Utxo} from "./utxo.model.js"

@Index_(["address", "tokenId"], {unique: true})
@Entity_()
export class TokenHolder {
    constructor(props?: Partial<TokenHolder>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    address!: string

    @StringColumn_({nullable: false})
    tokenId!: string

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @IntColumn_({nullable: false})
    nftCount!: number

    @Index_()
    @ManyToOne_('Token', {nullable: true})
    token!: Token

    @OneToMany_('Utxo', 'holder')
    utxos!: Utxo[]
}
