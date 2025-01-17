/*
 * eu-digital-green-certificates/ dgca-issuance-web
 *
 * (C) 2021, T-Systems International GmbH
 *
 * Deutsche Telekom AG and all other contributors /
 * copyright owners license this file to you under the Apache
 * License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { createCertificateQRData, CertificateMetaData } from '../misc/edgcProcessor'
import axios from 'axios';
import { EUDCC1 } from '../generated-files/dgc-combined-schema';
import CryptoJS from "crypto-js";

const api = axios.create({
    baseURL: '',
    headers: {
        "Content-Type": "application/json"
    },
});


export interface CertResult {
    qrCode: string,
    dgci: string,
    tan: string
}

// enum CertType {
//     Vaccination = 'Vaccination',
//     Recovery = 'Recovery',
//     Test = 'Test'
// }


// interface CertificateInit {
//     greenCertificateType: CertType,
// }

interface SigResponse {
    signature: string,
    tan: string
}


const signerCall = (id: string, hash: string): Promise<SigResponse> => {
    return api.get('/dgca-issuance-service/dgci/issue/' + id + '.json')
        .then(res => {
            const sigResponse: SigResponse = res.data;
            return sigResponse;
        });
}

const setDgci = (dgcPayload: EUDCC1, dgci: string) => {
    if (dgcPayload) {

        if (dgcPayload.v) {
            for (let vac of dgcPayload.v) {
                vac.ci = dgci;
            }
        }
        if (dgcPayload.r) {
            for (let rec of dgcPayload.r) {
                rec.ci = dgci;
            }
        }
        if (dgcPayload.t) {
            for (let tst of dgcPayload.t) {
                tst.ci = dgci;
            }
        }
    }
}

// const getEdgcType = (edgcPayload: EUDCC1): CertType => {
//     return edgcPayload.r ? CertType.Recovery
//         : edgcPayload.t
//             ? CertType.Test
//             : CertType.Vaccination;
// }


const generateQRCode = (edgcPayload: EUDCC1): Promise<CertResult> => {
    // const certInit: CertificateInit = {
    //     greenCertificateType: getEdgcType(edgcPayload)
    // }
    let tan: string = CryptoJS.lib.WordArray.random(5).toString(CryptoJS.enc.Hex).toUpperCase();

    return api.get('/dgca-issuance-service/dgci/issue.json')
        .then(response => {
            const certMetaData: CertificateMetaData = response.data;
            // generate random dgci
            const cert: {co: string} | undefined = edgcPayload.v?.[0] || edgcPayload.t?.[0] || edgcPayload.r?.[0];
            const padding = CryptoJS.lib.WordArray.random(10).toString(CryptoJS.enc.Hex).toUpperCase();
            certMetaData.dgci = `${certMetaData.dgci}${cert?.co}:F4K3${padding}`;
            setDgci(edgcPayload, certMetaData.dgci);
            return createCertificateQRData(edgcPayload, certMetaData,
                (hash) => {
                    return signerCall(response.data.id.toString(), hash)
                        .then((sigResponse) => {
                            // tan = sigResponse.tan;
                            return sigResponse.signature;
                        });
                })
                .then((qrCode: string) => {
                    //console.log("qr code: "+qrCode);
                    return {
                        qrCode: qrCode,
                        dgci: certMetaData.dgci,
                        tan: tan
                    }
                });
        });
}

export default generateQRCode;
