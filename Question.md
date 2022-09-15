

2000~4000
7010 7040 7100 7101 
803 

Client =(1)=> Websocket Server =(2)=>TCP client =(3)=> TCP server

Client <=(6)= Websocket Server <=(5)=TCP client <=(4)= TCP server


AdminCli 만 사용. 
upbit, korbit, huobi bithumb에 가격 체크하는 api 가 있음. 


(1)   clear 
- oWSMap 에 추가. => ws_man_t  



# (2) 
- pwd 암호화 
tr_2290(game: add user), 게임쪽 회원가입 tr 
[tr_7010 req.proc_sect????]-정체를 모르겠음

- tr_3402: 이더리움 관리자 지갑으로 모으기
    1) req 적당히 다듬어서 henesis에 request. 
    2) henesis 성공하면, admincli에 request. 
    3) 실패하면 오류 메세지.


- tr_2039: 출금 신청 요청
   1) coin_type: BTC, ETH, ETH-token 으로 나뉨. 
   2)coin_type에 따라 단위변환해주고, henesis request
   3)  henesis response를 추가하여 adminCli에 request
    admincli req +={addtional_data: henesis.id}

- tr_3403: 출금신청 상태 확인
   1) BTC, ETH 로 나뉨
   2) 트랜잭션정보로 henesis에 request
   3) henesis res에서 t_hash 도 받아와서 adminCli req에 넣어줌. 
      admincli req +={proc_stat: henesis.status,  addtional_data: henesis.transactionHash}

      status 값에 따라  req.proc_stat은
      requested, pending, status: 6 
      confirmed:7   
      failed,rejected:9   
    

- 메세지 파싱해서  tpc로 보냄


 (3),(4) clear 
 - comheadjs  client_proxy_t 에 이미 설정. 


# (5)
 - clientID가 undefined가 아니면 그냥 반환.

 - clientID가 undefined이고,, tr_3400이면,  입금내역 조회 API 호출
   1) BTC 랑 ETH 확인. btc_time 값이랑 . eth_time 값 받아서  henesis request 
   2) 3400 받아서 hensis request하고, 추가된 데이터가 있으면, 3401 로 admincli에 request 




admincli: 18507
rpp: 18508


# admin_node

1. 대부분의 tr을 admincli로 bypass

2. tr_2290(게임쪽 회원가입) 과 (tr_7010 && proc_sect가 4가 아니면)은 admin_node에서 비밀번호 암호화 후 admincli 요청

3. 몇몇 tr(tr_3402, tr_3403, tr_2039)은 admincli로 가기 전에  henesis를 거침.  henesis는 http api 서버
   henesis에 요청하고 반환 값을 기존 요청에 더해서 admincli에 요청


4. sym_code 가 아니라 coin_type에 따라 분기

- tr_3402: 이더리움 관리자 지갑으로 모으기
    1) req 적당히 다듬어서 henesis에 request. 
    2) henesis 성공하면, admincli에 request. 

- tr_2039: 출금 신청 요청
   1) coin_type: BTC, ETH, ETH-token 으로 나뉨. 
   2) coin_type에 따라 단위변환해주고, henesis request
   3) henesis response를 추가하여 adminCli에 request
      admincli req +={addtional_data: henesis.id}

- tr_3403: 출금신청 상태 확인
   1) BTC, ETH 로 나뉨
   2) henesis에 request
   3) henesis response에서 t_hash 받아와서 adminCli req에 넣어줌. 
      admincli req += {proc_stat: henesis.status,  addtional_data: henesis.transactionHash}

      status 값에 따라  req.proc_stat은
      requested, pending, status: 6 
      confirmed:7   
      failed,rejected:9   


5. setInterval  
   - DepositCheck (70 160에서 모두 주석 처리 되어있음) 1tr/5초
     tr_3400 -> admincli
     
       
   - Price (160에서는 주석 처리) 1tr/1분
     tr_2241 ->  admincli
     tr_803(upbit, korbit, huobi bithumb, huobi 에서 현재가격 조회하고,  기준호가 set redis) -> rpp    


6. tcp_client
   - tcp에서 받은 응답에 clientID가 들어있으면,  ws로 pass;
   - clientID가 없고, tr_3400이면, 입금내역 조회 API 호출 => henesis로  get_btc_trans, get_eth_trans
        추가된 데이터가 있거나 henesis요청 실패하면  self(tr_3401) 

7. tr_code
   * admincli
   - 2000~2999 거래소 관련 영역
   - 3003,4,7,8 빅워
   - 3402,3403은 
   - 7100 코인마스터
   - 7101 종목마스터

   * rpp
   - 803 set Redis

Q1. tr803(기준 호가 SET REDIS) 는 원래 응답없는 tr인지. 

<!-- Q2. henesis api server는 어디에 있는지?  -->

<!-- Q3. 160번에 있는 admin_node에 setInterval 하는 부분 전부 주석처리 되어있는데, 안 쓰는 건지?  -->
 
<!-- Q4. admin_node에는 소켓 클라이언트로 브로드캐스트 하는 부분 없는건지. 
    => 실시간 tr 없음 -->

Q5. 803 tr 안쓰고 바로 admin_node에서 바로 redis set 하는지. 


Q6. 주로 2000번대 TR bypass.
    redis 설정하는 부분만 해결하면됨.
     
















